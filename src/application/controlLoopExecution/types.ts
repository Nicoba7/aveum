import type { CanonicalDeviceCommand } from "./canonicalCommand";
import type { RuntimeExecutionPosture } from "./executionPolicyTypes";

export type CommandExecutionStatus = "issued" | "skipped" | "failed";

export interface ExecutionEconomicArbitrationTrace {
  comparisonScope: "device" | "household";
  selectedOpportunityId?: string;
  selectedExecutionRequestId: string;
  selectedDecisionId?: string;
  selectedTargetDeviceId: string;
  selectedAction?: string;
  selectedScorePencePerKwh: number;
  candidateScorePencePerKwh?: number;
  scoreDeltaPencePerKwh?: number;
  selectionReason: string;
  comparisonReason?: string;
  alternativesConsidered: number;
}

export interface CommandExecutionRequest {
  opportunityId?: string;
  executionRequestId: string;
  /** Transitional alias retained while the application seam settles. */
  requestId: string;
  idempotencyKey: string;
  decisionId?: string;
  targetDeviceId: string;
  planId: string;
  requestedAt: string;
  commandId: string;
  canonicalCommand: CanonicalDeviceCommand;
}

export interface CommandExecutionResult {
  opportunityId?: string;
  executionRequestId: string;
  /** Transitional alias retained while the application seam settles. */
  requestId: string;
  idempotencyKey: string;
  decisionId?: string;
  targetDeviceId: string;
  commandId: string;
  deviceId: string;
  status: CommandExecutionStatus;
  message?: string;
  errorCode?: string;
  reasonCodes?: string[];
  executionPosture?: RuntimeExecutionPosture;
  economicArbitration?: ExecutionEconomicArbitrationTrace;
}

/**
 * Application-layer execution port used to hand canonical commands to future live adapters.
 */
export interface DeviceCommandExecutor {
  execute(requests: CommandExecutionRequest[]): Promise<CommandExecutionResult[]>;
}
