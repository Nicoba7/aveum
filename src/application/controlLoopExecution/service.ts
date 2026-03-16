import type { ControlLoopInput, ControlLoopResult } from "../../controlLoop/controlLoop";
import { runControlLoop } from "../../controlLoop/controlLoop";
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  DeviceCommandExecutor,
} from "./types";
import { mapToCanonicalDeviceCommand } from "./canonicalCommand";
import { buildCommandExecutionIdentity, matchDecisionForCommand } from "./identity";

export interface ControlLoopExecutionServiceResult {
  controlLoopResult: ControlLoopResult;
  executionResults: CommandExecutionResult[];
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
  }));
}

/**
 * Thin application seam between canonical planning/control and future live command adapters.
 * See docs/architecture/execution-architecture.md for the orchestration boundary.
 */
export async function runControlLoopExecutionService(
  input: ControlLoopInput,
  executor: DeviceCommandExecutor,
): Promise<ControlLoopExecutionServiceResult> {
  const controlLoopResult = runControlLoop(input);
  const requests = mapRequests(input, controlLoopResult);

  if (requests.length === 0) {
    return {
      controlLoopResult,
      executionResults: [],
    };
  }

  try {
    const executionResults = await executor.execute(requests);
    return {
      controlLoopResult,
      executionResults,
    };
  } catch (error) {
    return {
      controlLoopResult,
      executionResults: mapFailedResults(requests, error),
    };
  }
}
