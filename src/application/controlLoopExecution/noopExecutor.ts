import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  DeviceCommandExecutor,
} from "./types";

/**
 * Deterministic non-device executor for simulation and early integration wiring.
 */
export class NoopDeviceCommandExecutor implements DeviceCommandExecutor {
  async execute(requests: CommandExecutionRequest[]): Promise<CommandExecutionResult[]> {
    return requests.map((request) => ({
      opportunityId: request.opportunityId,
      executionRequestId: request.executionRequestId,
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      decisionId: request.decisionId,
      targetDeviceId: request.targetDeviceId,
      commandId: request.commandId,
      deviceId: request.canonicalCommand.targetDeviceId,
      status: "skipped",
      message: "NOOP_EXECUTOR",
    }));
  }
}
