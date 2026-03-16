import type {
  ExecutionPolicyReasonCode,
  RuntimeExecutionGuardrailContext,
  RuntimeExecutionPosture,
} from "./executionPolicyTypes";

export interface RuntimeExecutionPostureClassification {
  posture: RuntimeExecutionPosture;
  reasonCodes: ExecutionPolicyReasonCode[];
  warning?: string;
}

/**
 * Pure runtime posture classifier.
 *
 * Establishes a single cycle-level operating posture for canonical execution
 * before per-command policy evaluation.
 */
export function classifyRuntimeExecutionPosture(
  runtimeContext?: RuntimeExecutionGuardrailContext,
): RuntimeExecutionPostureClassification {
  if (!runtimeContext) {
    return {
      posture: "normal",
      reasonCodes: [],
    };
  }

  const stalePlanReuseCount = runtimeContext.stalePlanReuseCount ?? 0;
  const expiredPlan = runtimeContext.planFreshnessStatus === "expired";
  const staleReuseActive = runtimeContext.planFreshnessStatus === "stale" && stalePlanReuseCount > 0;
  const replanGuardActive =
    stalePlanReuseCount > 0 &&
    runtimeContext.replanTrigger !== undefined &&
    runtimeContext.replanTrigger !== "executor_requested";

  const reasonCodes: ExecutionPolicyReasonCode[] = [];

  if (runtimeContext.safeHoldMode) {
    reasonCodes.push("RUNTIME_SAFE_HOLD_ACTIVE");
  }
  if (expiredPlan) {
    reasonCodes.push("RUNTIME_PLAN_EXPIRED");
  }
  if (staleReuseActive) {
    reasonCodes.push("RUNTIME_STALE_PLAN_REUSE");
  }
  if (replanGuardActive) {
    reasonCodes.push("RUNTIME_REPLAN_GUARD_ACTIVE");
  }

  if (runtimeContext.safeHoldMode) {
    return {
      posture: "hold_only",
      reasonCodes: ["RUNTIME_CONSERVATIVE_MODE_ACTIVE", ...reasonCodes],
      warning: runtimeContext.stalePlanWarning,
    };
  }

  if (reasonCodes.length > 0) {
    return {
      posture: "conservative",
      reasonCodes: ["RUNTIME_CONSERVATIVE_MODE_ACTIVE", ...reasonCodes],
      warning: runtimeContext.stalePlanWarning,
    };
  }

  return {
    posture: "normal",
    reasonCodes: [],
    warning: runtimeContext.stalePlanWarning,
  };
}
