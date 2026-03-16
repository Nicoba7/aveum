import type { ControlLoopInput, ControlLoopResult } from "../../controlLoop/controlLoop";
import { runControlLoop } from "../../controlLoop/controlLoop";
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  DeviceCommandExecutor,
} from "./types";
import { mapToCanonicalDeviceCommand } from "./canonicalCommand";
import { buildCommandExecutionIdentity, matchDecisionForCommand } from "./identity";
import type { DeviceCapabilitiesProvider } from "../../capabilities/deviceCapabilitiesProvider";
import {
  validateCanonicalCommandAgainstCapabilities,
  type CanonicalCommandValidationReasonCode,
} from "./commandValidation";
import type { DeviceShadowStore } from "../../shadow/deviceShadowStore";
import { projectExecutionToDeviceShadow } from "./projectExecutionToDeviceShadow";
import { reconcileCanonicalCommandWithShadow } from "./reconcileCanonicalCommandWithShadow";
import type { ExecutionJournalStore } from "../../journal/executionJournalStore";
import type {
  ExecutionCycleDecisionSummary,
  ExecutionCycleFinancialContext,
} from "../../journal/executionJournal";
import type { CycleEconomicSnapshot } from "../../journal/executionJournal";
import { toExecutionJournalEntry } from "./toExecutionJournalEntry";
import { evaluateExecutionPolicy } from "./evaluateExecutionPolicy";
import type {
  ExecutionPolicyReasonCode,
  RuntimeExecutionMode,
  RuntimeExecutionPosture,
  RuntimeExecutionGuardrailContext,
} from "./executionPolicyTypes";
import { projectExecutionOutcome } from "./projectExecutionOutcome";
import { evaluateRuntimeExecutionGuardrail } from "./evaluateRuntimeExecutionGuardrail";
import { classifyRuntimeExecutionPosture } from "./classifyRuntimeExecutionPosture";

export interface ControlLoopExecutionServiceResult {
  controlLoopResult: ControlLoopResult;
  executionResults: CommandExecutionResult[];
  executionPosture: RuntimeExecutionPosture;
}

function withExecutionPosture(
  results: CommandExecutionResult[],
  executionPosture: RuntimeExecutionPosture,
): CommandExecutionResult[] {
  return results.map((result) => ({
    ...result,
    executionPosture,
  }));
}

function mapPreflightFailure(
  request: CommandExecutionRequest,
  reasonCodes: CanonicalCommandValidationReasonCode[],
  message: string,
): CommandExecutionResult {
  return {
    executionRequestId: request.executionRequestId,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    decisionId: request.decisionId,
    targetDeviceId: request.targetDeviceId,
    commandId: request.commandId,
    deviceId: request.targetDeviceId,
    status: "failed",
    message,
    errorCode: reasonCodes[0],
    reasonCodes,
  };
}

function mapReconciliationSkip(
  request: CommandExecutionRequest,
  reasonCodes: string[],
): CommandExecutionResult {
  return {
    executionRequestId: request.executionRequestId,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    decisionId: request.decisionId,
    targetDeviceId: request.targetDeviceId,
    commandId: request.commandId,
    deviceId: request.targetDeviceId,
    status: "skipped",
    message: "Command skipped by canonical shadow reconciliation.",
    errorCode: reasonCodes[0],
    reasonCodes,
  };
}

function mapPolicyDenied(
  request: CommandExecutionRequest,
  reasonCodes: ExecutionPolicyReasonCode[],
): CommandExecutionResult {
  return {
    executionRequestId: request.executionRequestId,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    decisionId: request.decisionId,
    targetDeviceId: request.targetDeviceId,
    commandId: request.commandId,
    deviceId: request.targetDeviceId,
    status: "skipped",
    message: "Command denied by canonical execution policy.",
    errorCode: reasonCodes[0],
    reasonCodes,
  };
}

function appendJournalEntries(
  journalStore: ExecutionJournalStore | undefined,
  requestLookup: Map<string, CommandExecutionRequest>,
  outcomes: CommandExecutionResult[],
  recordedAt: string,
  cycleFinancialContext?: ExecutionCycleFinancialContext,
): void {
  if (!journalStore || !outcomes.length) {
    return;
  }

  outcomes.forEach((outcome) => {
    const request = requestLookup.get(outcome.executionRequestId);
    if (!request) {
      return;
    }

    journalStore.append(
      toExecutionJournalEntry(request.canonicalCommand, outcome, recordedAt, cycleFinancialContext),
    );
  });
}

function appendCycleHeartbeat(
  journalStore: ExecutionJournalStore | undefined,
  recordedAt: string,
  executionPosture: RuntimeExecutionPosture,
  runtimeGuardrailContext: RuntimeExecutionGuardrailContext | undefined,
  outcomes: CommandExecutionResult[],
  failClosedTriggered: boolean,
  cycleHeartbeatMeta?: { cycleId?: string; replanReason?: string },
  cycleFinancialContext?: ExecutionCycleFinancialContext,
): void {
  if (!journalStore) {
    return;
  }

  const commandsSuppressed = outcomes.filter(
    (r) => r.status === "skipped" && (r.reasonCodes ?? []).some((c) => c.startsWith("RUNTIME_")),
  ).length;

  journalStore.appendHeartbeat({
    entryKind: "cycle_heartbeat",
    cycleId: cycleHeartbeatMeta?.cycleId,
    recordedAt,
    executionPosture,
    planFreshnessStatus: runtimeGuardrailContext?.planFreshnessStatus,
    replanTrigger: runtimeGuardrailContext?.replanTrigger,
    replanReason: cycleHeartbeatMeta?.replanReason,
    stalePlanReuseCount: runtimeGuardrailContext?.stalePlanReuseCount,
    safeHoldMode: runtimeGuardrailContext?.safeHoldMode,
    stalePlanWarning: runtimeGuardrailContext?.stalePlanWarning,
    commandsIssued: outcomes.filter((r) => r.status === "issued").length,
    commandsSkipped: outcomes.filter((r) => r.status === "skipped").length,
    commandsFailed: outcomes.filter((r) => r.status === "failed").length,
    commandsSuppressed,
    failClosedTriggered,
    economicSnapshot: buildCycleEconomicSnapshot(cycleFinancialContext, executionPosture, commandsSuppressed),
    schemaVersion: "cycle-heartbeat.v1",
  });
}

const VALUE_SEEKING_ACTIONS = new Set([
  "charge_battery",
  "discharge_battery",
  "charge_ev",
  "export_to_grid",
]);

function buildCycleEconomicSnapshot(
  ctx: ExecutionCycleFinancialContext | undefined,
  executionPosture: RuntimeExecutionPosture,
  commandsSuppressed: number,
): CycleEconomicSnapshot | undefined {
  if (!ctx) {
    return undefined;
  }

  const hasValueSeekingDecisions = ctx.decisionsTaken.some((d) => VALUE_SEEKING_ACTIONS.has(d.action));
  const valueSeekingExecutionDeferred =
    executionPosture !== "normal" && commandsSuppressed > 0 && hasValueSeekingDecisions;

  return {
    optimizationMode: ctx.optimizationMode,
    planningConfidenceLevel: ctx.planningConfidenceLevel,
    conservativeAdjustmentApplied: ctx.conservativeAdjustmentApplied,
    hasValueSeekingDecisions,
    valueSeekingExecutionDeferred,
    estimatedSavingsVsBaselinePence: ctx.valueLedger.estimatedSavingsVsBaselinePence,
    planningInputCoverage: ctx.planningInputCoverage,
  };
}

function buildCycleDecisionSummaries(controlLoopResult: ControlLoopResult): ExecutionCycleDecisionSummary[] {
  return controlLoopResult.activeDecisions.map((decision) => ({
    decisionId: decision.decisionId,
    action: decision.action,
    targetDeviceIds: [...decision.targetDeviceIds],
    marginalImportAvoidance: decision.marginalImportAvoidancePencePerKwh,
    marginalExportValue: decision.marginalExportValuePencePerKwh,
    grossStoredEnergyValue: decision.grossStoredEnergyValuePencePerKwh,
    netStoredEnergyValue: decision.netStoredEnergyValuePencePerKwh,
    batteryDegradationCost: decision.batteryDegradationCostPencePerKwh,
    effectiveStoredEnergyValue: decision.effectiveStoredEnergyValuePencePerKwh,
    planningConfidenceLevel: decision.planningConfidenceLevel,
    conservativeAdjustmentApplied: decision.conservativeAdjustmentApplied,
    conservativeAdjustmentReason: decision.conservativeAdjustmentReason,
    decisionReason: decision.reason,
  }));
}

function mapRequests(input: ControlLoopInput, result: ControlLoopResult): CommandExecutionRequest[] {
  return result.commandsToIssue.map((command) => {
    const canonicalCommand = mapToCanonicalDeviceCommand(command);
    const matchedDecision = matchDecisionForCommand(canonicalCommand, result.activeDecisions);
    const identity = buildCommandExecutionIdentity(input.optimizerOutput.planId, canonicalCommand, matchedDecision);

    return {
      executionRequestId: identity.executionRequestId,
      requestId: identity.executionRequestId,
      idempotencyKey: identity.idempotencyKey,
      decisionId: identity.decisionId,
      targetDeviceId: identity.targetDeviceId,
      planId: input.optimizerOutput.planId,
      requestedAt: input.now,
      commandId: command.commandId,
      canonicalCommand,
    };
  });
}

function mapFailedResults(
  requests: CommandExecutionRequest[],
  error: unknown,
): CommandExecutionResult[] {
  const message = error instanceof Error ? error.message : "Device command execution failed.";

  return requests.map((request) => ({
    executionRequestId: request.executionRequestId,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    decisionId: request.decisionId,
    targetDeviceId: request.targetDeviceId,
    commandId: request.commandId,
    deviceId: request.targetDeviceId,
    status: "failed",
    message,
    errorCode: "EXECUTOR_ERROR",
    reasonCodes: ["EXECUTOR_ERROR"],
  }));
}

/**
 * Thin application seam between canonical planning/control and future live command adapters.
 * See docs/architecture/execution-architecture.md for the orchestration boundary.
 */
export async function runControlLoopExecutionService(
  input: ControlLoopInput,
  executor: DeviceCommandExecutor,
  capabilitiesProvider?: DeviceCapabilitiesProvider,
  shadowStore?: DeviceShadowStore,
  journalStore?: ExecutionJournalStore,
  cycleFinancialContext?: Omit<ExecutionCycleFinancialContext, "decisionsTaken">,
  runtimeGuardrailContext?: RuntimeExecutionGuardrailContext,
  runtimeExecutionMode: RuntimeExecutionMode = "standard",
  cycleHeartbeatMeta?: { cycleId?: string; replanReason?: string },
): Promise<ControlLoopExecutionServiceResult> {
  const controlLoopResult = runControlLoop(input);
  const missingRuntimeContextInStrictMode =
    runtimeExecutionMode === "continuous_live_strict" && !runtimeGuardrailContext;

  const postureClassification = missingRuntimeContextInStrictMode
    ? {
      posture: "hold_only" as const,
      reasonCodes: [
        "RUNTIME_CONSERVATIVE_MODE_ACTIVE" as const,
        "RUNTIME_CONTEXT_MISSING" as const,
      ],
      warning:
        "Runtime guardrail context missing in continuous live mode. Live dispatch suppressed.",
    }
    : classifyRuntimeExecutionPosture(runtimeGuardrailContext);

  const executionPosture = postureClassification.posture;
  const enrichedCycleFinancialContext = cycleFinancialContext
    ? {
      ...cycleFinancialContext,
      decisionsTaken: buildCycleDecisionSummaries(controlLoopResult),
      runtimeExecutionPosture: executionPosture,
      runtimeExecutionReasonCodes: postureClassification.reasonCodes,
      runtimeExecutionWarning: postureClassification.warning,
    }
    : undefined;

  const requests = mapRequests(input, controlLoopResult);
  const requestLookup = new Map(requests.map((request) => [request.executionRequestId, request]));

  if (requests.length === 0) {
    appendCycleHeartbeat(
      journalStore, input.now, executionPosture,
      runtimeGuardrailContext, [], missingRuntimeContextInStrictMode, cycleHeartbeatMeta,
      enrichedCycleFinancialContext,
    );
    return {
      controlLoopResult,
      executionResults: [],
      executionPosture,
    };
  }

  const preflightFailures: CommandExecutionResult[] = [];
  const reconciliationSkips: CommandExecutionResult[] = [];
  const policyDenials: CommandExecutionResult[] = [];
  const dispatchableRequests: CommandExecutionRequest[] = [];
  const reservedDeviceIds = new Set<string>();

  for (const request of requests) {
    if (missingRuntimeContextInStrictMode) {
      policyDenials.push(
        mapPolicyDenied(request, postureClassification.reasonCodes),
      );
      continue;
    }

    const matchedDecision = request.decisionId
      ? controlLoopResult.activeDecisions.find((decision) => decision.decisionId === request.decisionId)
      : undefined;

    const runtimeGuardrailDecision = evaluateRuntimeExecutionGuardrail({
      command: request.canonicalCommand,
      decisionAction: matchedDecision?.action,
      runtimeContext: runtimeGuardrailContext,
      runtimePosture: executionPosture,
      postureClassification,
    });

    if (runtimeGuardrailDecision.policy === "suppress") {
      policyDenials.push(
        mapPolicyDenied(request, runtimeGuardrailDecision.reasonCodes),
      );
      continue;
    }

    if (!capabilitiesProvider) {
      dispatchableRequests.push(request);
      continue;
    }

    const capabilities = capabilitiesProvider.getCapabilities(request.targetDeviceId);
    const validation = validateCanonicalCommandAgainstCapabilities(
      request.canonicalCommand,
      capabilities,
      input.now,
    );

    if (!validation.valid) {
      preflightFailures.push(
        mapPreflightFailure(
          request,
          validation.reasonCodes,
          "Command failed canonical preflight validation.",
        ),
      );
      continue;
    }

    if (shadowStore) {
      const existingShadow = shadowStore.getDeviceState(request.targetDeviceId);
      const reconciliation = reconcileCanonicalCommandWithShadow(
        request.canonicalCommand,
        existingShadow,
        input.now,
      );

      if (reconciliation.action === "skip") {
        reconciliationSkips.push(
          mapReconciliationSkip(request, reconciliation.reasonCodes),
        );
        continue;
      }
    }

    const policyDecision = evaluateExecutionPolicy({
      now: input.now,
      request,
      controlLoopResult,
      optimizerOutput: input.optimizerOutput,
      observedStateFreshness: input.observedStateFreshness,
      reservedDeviceIds,
    });

    if (!policyDecision.allowed) {
      policyDenials.push(mapPolicyDenied(request, policyDecision.reasonCodes));
      continue;
    }

    reservedDeviceIds.add(request.targetDeviceId);

    dispatchableRequests.push(request);
  }

  if (!dispatchableRequests.length) {
    const outcomes = withExecutionPosture(
      [...preflightFailures, ...reconciliationSkips, ...policyDenials],
      executionPosture,
    );
    appendJournalEntries(journalStore, requestLookup, outcomes, input.now, enrichedCycleFinancialContext);
    appendCycleHeartbeat(
      journalStore, input.now, executionPosture,
      runtimeGuardrailContext, outcomes, missingRuntimeContextInStrictMode, cycleHeartbeatMeta,
      enrichedCycleFinancialContext,
    );

    return {
      controlLoopResult,
      executionResults: outcomes,
      executionPosture,
    };
  }

  try {
    const executionResults = await executor.execute(dispatchableRequests);
    const outcomes = withExecutionPosture(
      [...preflightFailures, ...reconciliationSkips, ...policyDenials, ...executionResults],
      executionPosture,
    );

    appendJournalEntries(journalStore, requestLookup, outcomes, input.now, enrichedCycleFinancialContext);
    appendCycleHeartbeat(
      journalStore, input.now, executionPosture,
      runtimeGuardrailContext, outcomes, missingRuntimeContextInStrictMode, cycleHeartbeatMeta,
      enrichedCycleFinancialContext,
    );

    if (shadowStore) {
      const requestByExecutionId = new Map(
        dispatchableRequests.map((request) => [request.executionRequestId, request]),
      );

      executionResults.forEach((result) => {
        const request = requestByExecutionId.get(result.executionRequestId);
        if (!request) {
          return;
        }

        const outcomeProjection = projectExecutionOutcome(result, request.canonicalCommand);
        if (!outcomeProjection.shouldUpdateShadow) {
          return;
        }

        const existing = shadowStore.getDeviceState(request.targetDeviceId);
        const projected = projectExecutionToDeviceShadow(
          existing,
          request.canonicalCommand,
          result,
          input.now,
        );

        if (projected) {
          shadowStore.setDeviceState(request.targetDeviceId, projected);
        }
      });
    }

    return {
      controlLoopResult,
      executionResults: outcomes,
      executionPosture,
    };
  } catch (error) {
    const failedResults = mapFailedResults(dispatchableRequests, error);
    const outcomes = withExecutionPosture(
      [
        ...preflightFailures,
        ...reconciliationSkips,
        ...policyDenials,
        ...failedResults,
      ],
      executionPosture,
    );

    appendJournalEntries(journalStore, requestLookup, outcomes, input.now, enrichedCycleFinancialContext);
    appendCycleHeartbeat(
      journalStore, input.now, executionPosture,
      runtimeGuardrailContext, outcomes, missingRuntimeContextInStrictMode, cycleHeartbeatMeta,
      enrichedCycleFinancialContext,
    );

    return {
      controlLoopResult,
      executionResults: outcomes,
      executionPosture,
    };
  }
}
