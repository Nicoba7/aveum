import type { PlanningConfidenceLevel } from "../../domain";
import type { DecisionExplanation } from "../../journal/executionJournal";
import type { RuntimeExecutionPosture } from "./executionPolicyTypes";

export interface DecisionExplanationInput {
  opportunityId: string;
  decisionType: string;
  targetDeviceId?: string;
  decisionReason?: string;
  reasonCodes?: string[];
  planningConfidenceLevel?: PlanningConfidenceLevel;
  conservativeAdjustmentApplied?: boolean;
  conservativeAdjustmentReason?: string;
  economicSignals?: {
    effectiveStoredEnergyValuePencePerKwh?: number;
    netStoredEnergyValuePencePerKwh?: number;
    marginalImportAvoidancePencePerKwh?: number;
    exportValuePencePerKwh?: number;
  };
}

export interface DecisionExplanationContext {
  executionPosture: RuntimeExecutionPosture;
}

function formatPence(value: number): string {
  return `${value.toFixed(2)} p/kWh`;
}

function pushIfAbsent(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function mapConfidenceFromPlanningLevel(
  planningConfidenceLevel?: PlanningConfidenceLevel,
): DecisionExplanation["confidence"] {
  if (planningConfidenceLevel === "high") return "high";
  if (planningConfidenceLevel === "low") return "low";
  return "medium";
}

/**
 * Pure deterministic explanation generator for canonical opportunity decisions.
 *
 * Derives plain-language causal output from already-available runtime decision
 * inputs/outputs only. No external calls, persistence, or side effects.
 */
export function generateDecisionExplanation(
  decision: DecisionExplanationInput,
  context: DecisionExplanationContext,
): DecisionExplanation {
  const drivers: string[] = [];

  if (decision.decisionReason) {
    pushIfAbsent(drivers, `Decision reason: ${decision.decisionReason}`);
  }

  if (decision.planningConfidenceLevel) {
    pushIfAbsent(drivers, `Planning confidence: ${decision.planningConfidenceLevel}.`);
  }

  if (decision.economicSignals?.effectiveStoredEnergyValuePencePerKwh !== undefined) {
    pushIfAbsent(
      drivers,
      `Effective stored-energy value: ${formatPence(decision.economicSignals.effectiveStoredEnergyValuePencePerKwh)}.`,
    );
  } else if (decision.economicSignals?.netStoredEnergyValuePencePerKwh !== undefined) {
    pushIfAbsent(
      drivers,
      `Net stored-energy value: ${formatPence(decision.economicSignals.netStoredEnergyValuePencePerKwh)}.`,
    );
  }

  if (decision.economicSignals?.marginalImportAvoidancePencePerKwh !== undefined) {
    pushIfAbsent(
      drivers,
      `Import-avoidance signal: ${formatPence(decision.economicSignals.marginalImportAvoidancePencePerKwh)}.`,
    );
  }

  if (decision.economicSignals?.exportValuePencePerKwh !== undefined) {
    pushIfAbsent(
      drivers,
      `Export-value signal: ${formatPence(decision.economicSignals.exportValuePencePerKwh)}.`,
    );
  }

  if (decision.conservativeAdjustmentApplied && decision.conservativeAdjustmentReason) {
    pushIfAbsent(drivers, `Conservative adjustment active: ${decision.conservativeAdjustmentReason}`);
  }

  if ((decision.reasonCodes?.length ?? 0) > 0) {
    pushIfAbsent(drivers, `Decision constraints: ${(decision.reasonCodes ?? []).slice(0, 2).join(", ")}.`);
  }

  if (context.executionPosture !== "normal") {
    pushIfAbsent(drivers, `Runtime execution posture: ${context.executionPosture}.`);
  }

  pushIfAbsent(drivers, `Decision outcome: ${decision.decisionType}.`);
  pushIfAbsent(drivers, `Opportunity: ${decision.opportunityId}.`);

  if (drivers.length < 2) {
    pushIfAbsent(drivers, `Target device: ${decision.targetDeviceId ?? "unknown"}.`);
  }

  const boundedDrivers = drivers.slice(0, 5);
  const confidence = mapConfidenceFromPlanningLevel(decision.planningConfidenceLevel);

  const summary = decision.decisionReason
    ? `Decision ${decision.decisionType} for opportunity ${decision.opportunityId}: ${decision.decisionReason}`
    : `Decision ${decision.decisionType} for opportunity ${decision.opportunityId}.`;

  const caution =
    decision.conservativeAdjustmentReason
    ?? decision.reasonCodes?.[0]
    ?? (context.executionPosture !== "normal"
      ? `Runtime execution posture: ${context.executionPosture}.`
      : null);

  const confidenceReason = decision.planningConfidenceLevel
    ? `Planning confidence signal: ${decision.planningConfidenceLevel}.`
    : "Planning confidence signal not provided.";

  return {
    summary,
    drivers: boundedDrivers,
    confidence,
    confidence_reason: confidenceReason,
    caution,
  };
}