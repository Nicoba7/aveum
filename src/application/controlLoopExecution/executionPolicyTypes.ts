import type { ControlLoopResult } from "../../controlLoop/controlLoop";
import type { OptimizerOutput } from "../../domain/optimizer";
import type { ObservedStateFreshnessSummary } from "../../domain/observedStateFreshness";
import type { CommandExecutionRequest } from "./types";
import type {
  PlanFreshnessStatus,
  ReplanTrigger,
} from "../continuousLoop/controlLoopRunnerTypes";

/**
 * Platform-level policy gate reason codes.
 *
 * This is canonical policy logic, separate from capability validation and adapters.
 */
export type ExecutionPolicyReasonCode =
  | "EXECUTION_WINDOW_NOT_ACTIVE"
  | "PLANNING_WINDOW_EXPIRED"
  | "PLAN_INFEASIBLE"
  | "NO_ACTIONABLE_DECISION"
  | "CONFLICTING_COMMAND_FOR_DEVICE"
  | "COMMAND_STALE"
  | "OBSERVED_STATE_MISSING"
  | "OBSERVED_STATE_STALE"
  | "OBSERVED_STATE_UNKNOWN"
  | "RUNTIME_CONSERVATIVE_MODE_ACTIVE"
  | "RUNTIME_SAFE_HOLD_ACTIVE"
  | "RUNTIME_PLAN_EXPIRED"
  | "RUNTIME_STALE_PLAN_REUSE"
  | "RUNTIME_REPLAN_GUARD_ACTIVE"
  | "RUNTIME_CONTEXT_MISSING"
  | "POLICY_BLOCKED";

export interface ExecutionPolicyDecision {
  allowed: boolean;
  reasonCodes: ExecutionPolicyReasonCode[];
}

export interface ExecutionPolicyEvaluationInput {
  now: string;
  request: CommandExecutionRequest;
  controlLoopResult: ControlLoopResult;
  optimizerOutput: OptimizerOutput;
  observedStateFreshness?: ObservedStateFreshnessSummary;
  reservedDeviceIds?: Set<string>;
}

export interface RuntimeExecutionGuardrailContext {
  safeHoldMode?: boolean;
  planFreshnessStatus?: PlanFreshnessStatus;
  replanTrigger?: ReplanTrigger;
  stalePlanReuseCount?: number;
  stalePlanWarning?: string;
}

export type RuntimeExecutionPosture = "normal" | "conservative" | "hold_only";

export type RuntimeExecutionMode = "standard" | "continuous_live_strict";
