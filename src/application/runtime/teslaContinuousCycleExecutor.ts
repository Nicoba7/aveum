import type {
  CycleContext,
  CycleExecutor,
  CycleSummary,
  ReplanTrigger,
  ContinuousLoopConfig,
} from "../continuousLoop/controlLoopRunnerTypes";
import { ContinuousControlLoopRunner } from "../continuousLoop/controlLoopRunner";
import type { DeviceState } from "../../domain";
import type { OptimizerOutput } from "../../domain/optimizer";
import type { DeviceCapabilitiesProvider } from "../../capabilities/deviceCapabilitiesProvider";
import type { DeviceShadowStore } from "../../shadow/deviceShadowStore";
import type { ExecutionJournalStore } from "../../journal/executionJournalStore";
import type { ExecutionCycleFinancialContext } from "../../journal/executionJournal";
import type { ControlLoopDeviceTelemetry } from "../../controlLoop/controlLoop";
import type { RuntimeExecutionGuardrailContext } from "../controlLoopExecution/executionPolicyTypes";
import type { TeslaSingleRunRuntime } from "./teslaSingleRunBootstrap";

export interface ContinuousLiveExecutionEnvironment {
  siteId: string;
  timezone: string;
  devices: DeviceState[];
  capabilitiesProvider?: DeviceCapabilitiesProvider;
  shadowStore?: DeviceShadowStore;
  journalStore?: ExecutionJournalStore;
  cycleFinancialContext?: Omit<ExecutionCycleFinancialContext, "decisionsTaken">;
  deviceTelemetry?: Record<string, ControlLoopDeviceTelemetry>;
  freshnessMaxAgeSeconds?: number;
}

export interface ResolveContinuousLiveExecutionEnvironmentInput {
  nowIso: string;
  currentPlan: OptimizerOutput;
}

export type ResolveContinuousLiveExecutionEnvironment = (
  input: ResolveContinuousLiveExecutionEnvironmentInput,
) => Promise<ContinuousLiveExecutionEnvironment> | ContinuousLiveExecutionEnvironment;

export interface TeslaContinuousCycleExecutorOptions {
  runtime: TeslaSingleRunRuntime;
  buildPlan: (nowIso: string) => Promise<OptimizerOutput>;
  resolveExecutionEnvironment: ResolveContinuousLiveExecutionEnvironment;
}

const DRIFT_TRIGGERS = new Set<ReplanTrigger>([
  "command_outcome_failure",
  "soc_drift",
  "charging_state_mismatch",
]);

function mapRuntimeGuardrailContext(ctx: CycleContext): RuntimeExecutionGuardrailContext {
  return {
    safeHoldMode: ctx.safeHoldMode,
    planFreshnessStatus: ctx.planFreshnessStatus,
    replanTrigger: ctx.replanTrigger,
    stalePlanReuseCount: ctx.stalePlanReuseCount,
    stalePlanWarning: ctx.stalePlanWarning,
  };
}

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: "UnknownError", message: String(error) };
}

/**
 * Production continuous-loop CycleExecutor bridge for live Tesla runtime dispatch.
 *
 * This bridge is the canonical handoff from continuous-loop runtime truth
 * (CycleContext) into canonical execution policy + dispatch orchestration.
 */
export class TeslaContinuousCycleExecutor implements CycleExecutor {
  private readonly runtime: TeslaSingleRunRuntime;
  private readonly buildPlanFn: (nowIso: string) => Promise<OptimizerOutput>;
  private readonly resolveExecutionEnvironment: ResolveContinuousLiveExecutionEnvironment;

  constructor(options: TeslaContinuousCycleExecutorOptions) {
    this.runtime = options.runtime;
    this.buildPlanFn = options.buildPlan;
    this.resolveExecutionEnvironment = options.resolveExecutionEnvironment;
  }

  async buildPlan(nowIso: string): Promise<OptimizerOutput> {
    return this.buildPlanFn(nowIso);
  }

  async execute(ctx: CycleContext): Promise<CycleSummary> {
    try {
      const environment = await this.resolveExecutionEnvironment({
        nowIso: ctx.nowIso,
        currentPlan: ctx.currentPlan,
      });

      const result = await this.runtime.runCycle({
        now: ctx.nowIso,
        siteId: environment.siteId,
        timezone: environment.timezone,
        devices: environment.devices,
        optimizerOutput: ctx.currentPlan,
        capabilitiesProvider: environment.capabilitiesProvider,
        shadowStore: environment.shadowStore,
        journalStore: environment.journalStore,
        cycleFinancialContext: environment.cycleFinancialContext,
        runtimeGuardrailContext: mapRuntimeGuardrailContext(ctx),
        runtimeExecutionMode: "continuous_live_strict",
        cycleId: ctx.cycleId,
        replanReason: ctx.replanReason,
        deviceTelemetry: environment.deviceTelemetry,
        freshnessMaxAgeSeconds: environment.freshnessMaxAgeSeconds,
      });

      const observedState = this.runtime.observedStateStore.getDeviceState(this.runtime.config.vehicleId);
      const driftTrigger =
        ctx.replanTrigger && DRIFT_TRIGGERS.has(ctx.replanTrigger)
          ? [ctx.replanTrigger]
          : undefined;

      return {
        cycleId: ctx.cycleId,
        nowIso: ctx.nowIso,
        status: "ok",
        replanRequired: result.controlLoopResult.replanRequired,
        issuedCommandCount: result.executionSummary.issued,
        skippedCommandCount: result.executionSummary.skipped,
        failedCommandCount: result.executionSummary.failed,
        journalEntriesWritten: result.executionResults.length,
        planAgeSeconds: ctx.planAgeSeconds,
        planFreshnessStatus: ctx.planFreshnessStatus,
        replanTriggered: ctx.replanTriggered,
        replanTrigger: ctx.replanTrigger,
        replanReason: ctx.replanReason,
        stalePlanReuseCount: ctx.stalePlanReuseCount,
        observedBatterySocPercent: observedState?.batterySocPercent,
        observedChargingState: observedState?.chargingState ?? "unknown",
        driftDetected: driftTrigger !== undefined,
        driftTriggers: driftTrigger,
      };
    } catch (error) {
      return {
        cycleId: ctx.cycleId,
        nowIso: ctx.nowIso,
        status: "error",
        replanRequired: false,
        issuedCommandCount: 0,
        skippedCommandCount: 0,
        failedCommandCount: 0,
        journalEntriesWritten: 0,
        error: normalizeError(error),
        planAgeSeconds: ctx.planAgeSeconds,
        planFreshnessStatus: ctx.planFreshnessStatus,
        replanTriggered: ctx.replanTriggered,
        replanTrigger: ctx.replanTrigger,
        replanReason: ctx.replanReason,
        stalePlanReuseCount: ctx.stalePlanReuseCount,
      };
    }
  }
}

export interface CreateTeslaContinuousControlLoopRunnerOptions {
  loopConfig: ContinuousLoopConfig;
  cycleExecutor: TeslaContinuousCycleExecutorOptions;
  runnerOptions?: ConstructorParameters<typeof ContinuousControlLoopRunner>[2];
}

export function createTeslaContinuousControlLoopRunner(
  options: CreateTeslaContinuousControlLoopRunnerOptions,
): ContinuousControlLoopRunner {
  const executor = new TeslaContinuousCycleExecutor(options.cycleExecutor);
  return new ContinuousControlLoopRunner(
    options.loopConfig,
    executor,
    options.runnerOptions,
  );
}
