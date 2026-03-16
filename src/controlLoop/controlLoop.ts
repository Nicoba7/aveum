import type { DeviceCommand, SystemState } from "../domain";
import type { OptimizerDecision, OptimizerOutput } from "../domain/optimizer";
import type { ObservedStateFreshnessSummary } from "../domain/observedStateFreshness";
import type { TelemetryHealthSummary } from "../domain/telemetryHealth";

export interface ControlLoopDeviceTelemetry {
  lastSeenAt?: string;
  online?: boolean;
  mode?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ControlLoopInput {
  now: string;
  systemState: SystemState;
  optimizerOutput: OptimizerOutput;
  deviceTelemetry?: Record<string, ControlLoopDeviceTelemetry>;
  observedStateFreshness?: ObservedStateFreshnessSummary;
  telemetryHealth?: TelemetryHealthSummary;
}

export interface SkippedDecision {
  decisionId: string;
  reason: "infeasible" | "expired";
}

export interface ControlLoopResult {
  activeDecisions: OptimizerDecision[];
  commandsToIssue: DeviceCommand[];
  skippedDecisions: SkippedDecision[];
  replanRequired: boolean;
  reasons: string[];
}

function toMillis(timestamp: string): number {
  return new Date(timestamp).getTime();
}

function includesNow(nowMs: number, startAt: string, endAt: string): boolean {
  const startMs = toMillis(startAt);
  const endMs = toMillis(endAt);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && nowMs >= startMs && nowMs < endMs;
}

function isExpired(nowMs: number, endAt: string): boolean {
  const endMs = toMillis(endAt);
  return Number.isFinite(endMs) && nowMs >= endMs;
}

function commandWindow(command: DeviceCommand): { startAt: string; endAt: string } | undefined {
  if (command.effectiveWindow) {
    return command.effectiveWindow;
  }

  if (command.type === "schedule_window") {
    return command.window;
  }

  return undefined;
}

/**
 * Select decisions that are currently actionable at a control-loop tick.
 */
export function selectActiveDecisions(now: string, optimizerOutput: OptimizerOutput): OptimizerDecision[] {
  const nowMs = toMillis(now);
  if (!Number.isFinite(nowMs)) {
    return [];
  }

  if (optimizerOutput.feasibility && !optimizerOutput.feasibility.executable) {
    return [];
  }

  return optimizerOutput.decisions.filter((decision) =>
    includesNow(nowMs, decision.executionWindow.startAt, decision.executionWindow.endAt),
  );
}

/**
 * Select planned commands that should be issued at this control-loop tick.
 */
export function selectCommandsToIssue(now: string, optimizerOutput: OptimizerOutput): DeviceCommand[] {
  const nowMs = toMillis(now);
  if (!Number.isFinite(nowMs)) {
    return [];
  }

  return optimizerOutput.recommendedCommands.filter((command) => {
    const window = commandWindow(command);
    if (!window) {
      return false;
    }

    return includesNow(nowMs, window.startAt, window.endAt);
  });
}

/**
 * Canonical control-loop boundary that turns optimizer plan output into per-tick execution intent.
 *
 * Architecture note: keep this module pure as described in docs/architecture/execution-architecture.md.
 */
export function runControlLoop(input: ControlLoopInput): ControlLoopResult {
  const nowMs = toMillis(input.now);
  const reasons: string[] = [];

  if (!Number.isFinite(nowMs)) {
    return {
      activeDecisions: [],
      commandsToIssue: [],
      skippedDecisions: [],
      replanRequired: true,
      reasons: ["INVALID_NOW_TIMESTAMP"],
    };
  }

  const activeDecisions = selectActiveDecisions(input.now, input.optimizerOutput);
  const commandsToIssue = selectCommandsToIssue(input.now, input.optimizerOutput);

  const skippedDecisions: SkippedDecision[] = [];
  const isFeasible = input.optimizerOutput.feasibility?.executable ?? true;
  if (!isFeasible) {
    input.optimizerOutput.decisions.forEach((decision) => {
      skippedDecisions.push({ decisionId: decision.decisionId, reason: "infeasible" });
    });
    reasons.push(...(input.optimizerOutput.feasibility?.blockingCodes ?? ["PLAN_INFEASIBLE"]));
  }

  input.optimizerOutput.decisions.forEach((decision) => {
    if (isExpired(nowMs, decision.executionWindow.endAt)) {
      skippedDecisions.push({ decisionId: decision.decisionId, reason: "expired" });
    }
  });

  if (input.optimizerOutput.planningWindow && isExpired(nowMs, input.optimizerOutput.planningWindow.endAt)) {
    reasons.push("PLANNING_WINDOW_EXPIRED");
  }

  const hasNoCurrentAction = activeDecisions.length === 0 && commandsToIssue.length === 0;
  const windowExpired = reasons.includes("PLANNING_WINDOW_EXPIRED");
  const replanRequired = !isFeasible || windowExpired || hasNoCurrentAction;

  if (hasNoCurrentAction) {
    reasons.push("NO_ACTIVE_DECISIONS");
  }

  return {
    activeDecisions,
    commandsToIssue,
    skippedDecisions,
    replanRequired,
    reasons: [...new Set(reasons)],
  };
}
