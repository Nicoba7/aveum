import type { ControlLoopInput, ControlLoopResult } from "../../controlLoop/controlLoop";
import { runControlLoop } from "../../controlLoop/controlLoop";
import type { OptimizerOpportunity } from "../../domain/optimizer";
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  DeviceCommandExecutor,
  ExecutionEconomicArbitrationTrace,
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
import {
  evaluateEconomicActionPreference,
  scoreEconomicActionCandidate,
  type EconomicActionCandidate,
} from "./evaluateEconomicActionPreference";
import { evaluateHouseholdEconomicOpportunity } from "./evaluateHouseholdEconomicOpportunity";

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
    opportunityId: request.opportunityId,
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
    opportunityId: request.opportunityId,
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
  economicArbitration?: ExecutionEconomicArbitrationTrace,
): CommandExecutionResult {
  return {
    opportunityId: request.opportunityId,
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
    economicArbitration,
  };
}

interface EconomicPrerejection {
  reasonCodes: ExecutionPolicyReasonCode[];
  economicArbitration?: ExecutionEconomicArbitrationTrace;
}

interface EligibleOpportunity {
  request: CommandExecutionRequest;
  matchedDecision?: ControlLoopResult["activeDecisions"][number];
  economicCandidate?: EconomicActionCandidate;
}

function appendJournalEntries(
  journalStore: ExecutionJournalStore | undefined,
  requestLookup: Map<string, CommandExecutionRequest>,
  outcomes: CommandExecutionResult[],
  recordedAt: string,
  cycleId: string | undefined,
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
      toExecutionJournalEntry(request.canonicalCommand, outcome, recordedAt, cycleId, cycleFinancialContext),
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
    (r) =>
      r.status === "skipped" &&
      (r.reasonCodes ?? []).some((c) => c.startsWith("RUNTIME_") || c.startsWith("ECONOMIC_")),
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

function buildEconomicPreferencePreselection(
  opportunities: EligibleOpportunity[],
  financialContext: ExecutionCycleFinancialContext,
): {
  prerejections: Map<string, EconomicPrerejection>;
  selectedTraces: Map<string, ExecutionEconomicArbitrationTrace>;
} {
  const prerejections = new Map<string, EconomicPrerejection>();
  const selectedTraces = new Map<string, ExecutionEconomicArbitrationTrace>();

  const byDevice = new Map<string, EligibleOpportunity[]>();
  for (const opportunity of opportunities) {
    const group = byDevice.get(opportunity.request.targetDeviceId) ?? [];
    group.push(opportunity);
    byDevice.set(opportunity.request.targetDeviceId, group);
  }

  for (const deviceOpportunities of byDevice.values()) {
    if (deviceOpportunities.length <= 1) {
      continue;
    }

    const candidates: EconomicActionCandidate[] = deviceOpportunities.map((opportunity) =>
      opportunity.economicCandidate ?? buildEconomicCandidate(opportunity.request, financialContext),
    );

    const preference = evaluateEconomicActionPreference(candidates, {
      planningConfidenceLevel: financialContext.planningConfidenceLevel,
      optimizationMode: financialContext.optimizationMode,
    });

    if (!preference) {
      continue;
    }

    const selectedCandidate = candidates.find(
      (candidate) => candidate.executionRequestId === preference.preferredRequestId,
    );

    if (!selectedCandidate) {
      continue;
    }

    selectedTraces.set(selectedCandidate.executionRequestId, {
      comparisonScope: "device",
      selectedOpportunityId: selectedCandidate.opportunityId,
      selectedExecutionRequestId: selectedCandidate.executionRequestId,
      selectedDecisionId: selectedCandidate.decisionId,
      selectedTargetDeviceId: selectedCandidate.targetDeviceId,
      selectedAction: selectedCandidate.action,
      selectedScorePencePerKwh: preference.selectionScore,
      selectionReason: preference.selectionReason,
      alternativesConsidered: preference.alternativesConsidered,
    });

    for (const rejection of preference.rejections) {
      const rejectedCandidate = candidates.find(
        (candidate) => candidate.executionRequestId === rejection.executionRequestId,
      );
      prerejections.set(rejection.executionRequestId, {
        reasonCodes: ["INFERIOR_ECONOMIC_VALUE"],
        economicArbitration: {
          comparisonScope: "device",
          selectedOpportunityId: selectedCandidate.opportunityId,
          selectedExecutionRequestId: selectedCandidate.executionRequestId,
          selectedDecisionId: selectedCandidate.decisionId,
          selectedTargetDeviceId: selectedCandidate.targetDeviceId,
          selectedAction: selectedCandidate.action,
          selectedScorePencePerKwh: preference.selectionScore,
          candidateScorePencePerKwh: rejectedCandidate
            ? scoreEconomicActionCandidate(rejectedCandidate)
            : undefined,
          scoreDeltaPencePerKwh: rejection.inferiorByPencePerKwh,
          selectionReason: preference.selectionReason,
          comparisonReason: rejection.selectionReason,
          alternativesConsidered: preference.alternativesConsidered,
        },
      });
    }
  }

  return { prerejections, selectedTraces };
}

function buildEconomicCandidate(
  request: CommandExecutionRequest,
  financialContext: ExecutionCycleFinancialContext,
): EconomicActionCandidate {
  const decision = request.decisionId
    ? financialContext.decisionsTaken.find((item) => item.decisionId === request.decisionId)
    : undefined;

  return {
    opportunityId: request.opportunityId,
    executionRequestId: request.executionRequestId,
    decisionId: request.decisionId,
    targetDeviceId: request.targetDeviceId,
    action: decision?.action as EconomicActionCandidate["action"],
    command: request.canonicalCommand,
    effectiveStoredEnergyValue: decision?.effectiveStoredEnergyValue,
    netStoredEnergyValue: decision?.netStoredEnergyValue,
    marginalImportAvoidance: decision?.marginalImportAvoidance,
    marginalExportValue: decision?.marginalExportValue,
  };
}

function buildHouseholdEconomicArbitration(
  opportunities: EligibleOpportunity[],
  financialContext: ExecutionCycleFinancialContext,
): {
  prerejections: Map<string, EconomicPrerejection>;
  selectedTraces: Map<string, ExecutionEconomicArbitrationTrace>;
} {
  const prerejections = new Map<string, EconomicPrerejection>();
  const selectedTraces = new Map<string, ExecutionEconomicArbitrationTrace>();
  const candidates = opportunities.map((opportunity) =>
    opportunity.economicCandidate ?? buildEconomicCandidate(opportunity.request, financialContext),
  );
  const arbitration = evaluateHouseholdEconomicOpportunity(candidates, {
    planningConfidenceLevel: financialContext.planningConfidenceLevel,
    optimizationMode: financialContext.optimizationMode,
  });

  if (!arbitration) {
    return { prerejections, selectedTraces };
  }

  const selectedCandidate = candidates.find(
    (candidate) => candidate.executionRequestId === arbitration.preferredRequestId,
  );

  if (!selectedCandidate) {
    return { prerejections, selectedTraces };
  }

  selectedTraces.set(selectedCandidate.executionRequestId, {
    comparisonScope: "household",
    selectedOpportunityId: selectedCandidate.opportunityId,
    selectedExecutionRequestId: selectedCandidate.executionRequestId,
    selectedDecisionId: selectedCandidate.decisionId,
    selectedTargetDeviceId: selectedCandidate.targetDeviceId,
    selectedAction: selectedCandidate.action,
    selectedScorePencePerKwh: arbitration.selectionScore,
    selectionReason: arbitration.selectionReason,
    alternativesConsidered: arbitration.alternativesConsidered,
  });

  arbitration.rejections.forEach((rejection) => {
    prerejections.set(rejection.executionRequestId, {
      reasonCodes: ["INFERIOR_HOUSEHOLD_ECONOMIC_VALUE"],
      economicArbitration: {
        comparisonScope: "household",
        selectedOpportunityId: selectedCandidate.opportunityId,
        selectedExecutionRequestId: selectedCandidate.executionRequestId,
        selectedDecisionId: selectedCandidate.decisionId,
        selectedTargetDeviceId: selectedCandidate.targetDeviceId,
        selectedAction: selectedCandidate.action,
        selectedScorePencePerKwh: arbitration.selectionScore,
        candidateScorePencePerKwh: rejection.candidateScore,
        scoreDeltaPencePerKwh: rejection.inferiorByPencePerKwh,
        selectionReason: arbitration.selectionReason,
        comparisonReason: rejection.selectionReason,
        alternativesConsidered: arbitration.alternativesConsidered,
      },
    });
  });

  return { prerejections, selectedTraces };
}

function buildEligibleOpportunitySet(params: {
  requests: CommandExecutionRequest[];
  input: ControlLoopInput;
  controlLoopResult: ControlLoopResult;
  capabilitiesProvider?: DeviceCapabilitiesProvider;
  shadowStore?: DeviceShadowStore;
  runtimeGuardrailContext?: RuntimeExecutionGuardrailContext;
  executionPosture: RuntimeExecutionPosture;
  postureClassification: ReturnType<typeof classifyRuntimeExecutionPosture> | {
    posture: "hold_only";
    reasonCodes: readonly ["RUNTIME_CONSERVATIVE_MODE_ACTIVE", "RUNTIME_CONTEXT_MISSING"];
    warning: string;
  };
  missingRuntimeContextInStrictMode: boolean;
  cycleFinancialContext?: ExecutionCycleFinancialContext;
}): {
  eligibleOpportunities: EligibleOpportunity[];
  preflightFailures: CommandExecutionResult[];
  reconciliationSkips: CommandExecutionResult[];
  policyDenials: CommandExecutionResult[];
} {
  const eligibleOpportunities: EligibleOpportunity[] = [];
  const preflightFailures: CommandExecutionResult[] = [];
  const reconciliationSkips: CommandExecutionResult[] = [];
  const policyDenials: CommandExecutionResult[] = [];

  for (const request of params.requests) {
    if (params.missingRuntimeContextInStrictMode) {
      policyDenials.push(mapPolicyDenied(request, [...params.postureClassification.reasonCodes]));
      continue;
    }

    const matchedDecision = request.decisionId
      ? params.controlLoopResult.activeDecisions.find((decision) => decision.decisionId === request.decisionId)
      : undefined;

    const runtimeGuardrailDecision = evaluateRuntimeExecutionGuardrail({
      command: request.canonicalCommand,
      decisionAction: matchedDecision?.action,
      cycleFinancialContext: params.cycleFinancialContext,
      runtimeContext: params.runtimeGuardrailContext,
      runtimePosture: params.executionPosture,
      postureClassification: params.postureClassification,
    });

    if (runtimeGuardrailDecision.policy === "suppress") {
      policyDenials.push(mapPolicyDenied(request, runtimeGuardrailDecision.reasonCodes));
      continue;
    }

    if (params.capabilitiesProvider) {
      const capabilities = params.capabilitiesProvider.getCapabilities(request.targetDeviceId);
      const validation = validateCanonicalCommandAgainstCapabilities(
        request.canonicalCommand,
        capabilities,
        params.input.now,
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
    }

    if (params.shadowStore) {
      const existingShadow = params.shadowStore.getDeviceState(request.targetDeviceId);
      const reconciliation = reconcileCanonicalCommandWithShadow(
        request.canonicalCommand,
        existingShadow,
        params.input.now,
      );

      if (reconciliation.action === "skip") {
        reconciliationSkips.push(mapReconciliationSkip(request, reconciliation.reasonCodes));
        continue;
      }
    }

    const policyDecision = evaluateExecutionPolicy({
      now: params.input.now,
      request,
      controlLoopResult: params.controlLoopResult,
      optimizerOutput: params.input.optimizerOutput,
      observedStateFreshness: params.input.observedStateFreshness,
    });

    if (!policyDecision.allowed) {
      policyDenials.push(mapPolicyDenied(request, policyDecision.reasonCodes));
      continue;
    }

    eligibleOpportunities.push({
      request,
      matchedDecision,
      economicCandidate: params.cycleFinancialContext
        ? buildEconomicCandidate(request, params.cycleFinancialContext)
        : undefined,
    });
  }

  return {
    eligibleOpportunities,
    preflightFailures,
    reconciliationSkips,
    policyDenials,
  };
}

function attachEconomicArbitrationTraces(
  results: CommandExecutionResult[],
  traces: Map<string, ExecutionEconomicArbitrationTrace>,
): CommandExecutionResult[] {
  return results.map((result) => {
    const economicArbitration = traces.get(result.executionRequestId);
    return economicArbitration ? { ...result, economicArbitration } : result;
  });
}

function mapRequests(input: ControlLoopInput, result: ControlLoopResult): CommandExecutionRequest[] {
  if (result.activeOpportunities.length > 0) {
    return result.activeOpportunities.map((opportunity) =>
      mapOpportunityToRequest(input, result, opportunity),
    );
  }

  return result.commandsToIssue.map((command) => {
    const canonicalCommand = mapToCanonicalDeviceCommand(command);
    const matchedDecision = matchDecisionForCommand(canonicalCommand, result.activeDecisions);
    const identity = buildCommandExecutionIdentity(input.optimizerOutput.planId, canonicalCommand, matchedDecision);

    return {
      opportunityId: identity.opportunityId,
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

function mapOpportunityToRequest(
  input: ControlLoopInput,
  result: ControlLoopResult,
  opportunity: OptimizerOpportunity,
): CommandExecutionRequest {
  const canonicalCommand = mapToCanonicalDeviceCommand(opportunity.command);
  const matchedDecision = opportunity.decisionId
    ? result.activeDecisions.find((decision) => decision.decisionId === opportunity.decisionId)
    : matchDecisionForCommand(canonicalCommand, result.activeDecisions);
  const identity = buildCommandExecutionIdentity(
    input.optimizerOutput.planId,
    canonicalCommand,
    matchedDecision,
    opportunity.opportunityId,
  );

  return {
    opportunityId: opportunity.opportunityId,
    executionRequestId: identity.executionRequestId,
    requestId: identity.executionRequestId,
    idempotencyKey: identity.idempotencyKey,
    decisionId: identity.decisionId,
    targetDeviceId: identity.targetDeviceId,
    planId: input.optimizerOutput.planId,
    requestedAt: input.now,
    commandId: opportunity.command.commandId,
    canonicalCommand,
  };
}

function mapFailedResults(
  requests: CommandExecutionRequest[],
  error: unknown,
): CommandExecutionResult[] {
  const message = error instanceof Error ? error.message : "Device command execution failed.";

  return requests.map((request) => ({
    opportunityId: request.opportunityId,
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

  const dispatchableRequests: CommandExecutionRequest[] = [];
  const reservedDeviceIds = new Set<string>();
  const {
    eligibleOpportunities,
    preflightFailures,
    reconciliationSkips,
    policyDenials,
  } = buildEligibleOpportunitySet({
    requests,
    input,
    controlLoopResult,
    capabilitiesProvider,
    shadowStore,
    runtimeGuardrailContext,
    executionPosture,
    postureClassification,
    missingRuntimeContextInStrictMode,
    cycleFinancialContext: enrichedCycleFinancialContext,
  });

  const deviceEconomicArbitration = enrichedCycleFinancialContext
    ? buildEconomicPreferencePreselection(eligibleOpportunities, enrichedCycleFinancialContext)
    : {
        prerejections: new Map<string, EconomicPrerejection>(),
        selectedTraces: new Map<string, ExecutionEconomicArbitrationTrace>(),
      };

  const postDeviceEligibleOpportunities = eligibleOpportunities.filter(
    (opportunity) => !deviceEconomicArbitration.prerejections.has(opportunity.request.executionRequestId),
  );

  const householdEconomicArbitration = enrichedCycleFinancialContext
    ? buildHouseholdEconomicArbitration(postDeviceEligibleOpportunities, enrichedCycleFinancialContext)
    : {
        prerejections: new Map<string, EconomicPrerejection>(),
        selectedTraces: new Map<string, ExecutionEconomicArbitrationTrace>(),
      };

  deviceEconomicArbitration.prerejections.forEach((rejection, executionRequestId) => {
    const request = requestLookup.get(executionRequestId);
    if (!request) {
      return;
    }
    policyDenials.push(
      mapPolicyDenied(request, rejection.reasonCodes, rejection.economicArbitration),
    );
  });

  householdEconomicArbitration.prerejections.forEach((rejection, executionRequestId) => {
    const request = requestLookup.get(executionRequestId);
    if (!request) {
      return;
    }
    policyDenials.push(
      mapPolicyDenied(request, rejection.reasonCodes, rejection.economicArbitration),
    );
  });

  const selectedEconomicTraces = new Map<string, ExecutionEconomicArbitrationTrace>([
    ...deviceEconomicArbitration.selectedTraces,
    ...householdEconomicArbitration.selectedTraces,
  ]);

  const finalEligibleOpportunities = postDeviceEligibleOpportunities.filter(
    (opportunity) => !householdEconomicArbitration.prerejections.has(opportunity.request.executionRequestId),
  );

  for (const opportunity of finalEligibleOpportunities) {
    const policyDecision = evaluateExecutionPolicy({
      now: input.now,
      request: opportunity.request,
      controlLoopResult,
      optimizerOutput: input.optimizerOutput,
      observedStateFreshness: input.observedStateFreshness,
      reservedDeviceIds,
    });

    if (!policyDecision.allowed) {
      policyDenials.push(mapPolicyDenied(opportunity.request, policyDecision.reasonCodes));
      continue;
    }

    reservedDeviceIds.add(opportunity.request.targetDeviceId);
    dispatchableRequests.push(opportunity.request);
  }

  if (!dispatchableRequests.length) {
    const outcomes = withExecutionPosture(
      [...preflightFailures, ...reconciliationSkips, ...policyDenials],
      executionPosture,
    );
    appendJournalEntries(
      journalStore,
      requestLookup,
      outcomes,
      input.now,
      cycleHeartbeatMeta?.cycleId,
      enrichedCycleFinancialContext,
    );
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
    const executionResults = attachEconomicArbitrationTraces(
      await executor.execute(dispatchableRequests),
      selectedEconomicTraces,
    );
    const outcomes = withExecutionPosture(
      [...preflightFailures, ...reconciliationSkips, ...policyDenials, ...executionResults],
      executionPosture,
    );

    appendJournalEntries(
      journalStore,
      requestLookup,
      outcomes,
      input.now,
      cycleHeartbeatMeta?.cycleId,
      enrichedCycleFinancialContext,
    );
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
    const failedResults = attachEconomicArbitrationTraces(
      mapFailedResults(dispatchableRequests, error),
      selectedEconomicTraces,
    );
    const outcomes = withExecutionPosture(
      [
        ...preflightFailures,
        ...reconciliationSkips,
        ...policyDenials,
        ...failedResults,
      ],
      executionPosture,
    );

    appendJournalEntries(
      journalStore,
      requestLookup,
      outcomes,
      input.now,
      cycleHeartbeatMeta?.cycleId,
      enrichedCycleFinancialContext,
    );
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
