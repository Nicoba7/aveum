import type { TimeWindow } from "../../domain";
import type { OptimizerDecision } from "../../domain/optimizer";
import type { CanonicalDeviceCommand } from "./canonicalCommand";

export interface CommandExecutionIdentity {
  opportunityId?: string;
  executionRequestId: string;
  idempotencyKey: string;
  decisionId?: string;
  targetDeviceId: string;
}

function commandWindow(command: CanonicalDeviceCommand): TimeWindow | undefined {
  return command.effectiveWindow;
}

function commandIntentDescriptor(command: CanonicalDeviceCommand): string {
  switch (command.kind) {
    case "set_mode":
      return `${command.kind}:${command.mode}`;
    case "set_power_limit":
      return `${command.kind}:${command.powerW}`;
    case "set_target_soc":
      return `${command.kind}:${command.targetSocPercent}`;
    case "set_reserve_soc":
      return `${command.kind}:${command.reserveSocPercent}`;
    case "schedule_window":
      return `${command.kind}:${command.targetMode ?? "unspecified"}`;
    default:
      return command.kind;
  }
}

function windowsMatch(command: CanonicalDeviceCommand, decision: OptimizerDecision): boolean {
  const window = commandWindow(command);
  if (!window) {
    return false;
  }

  return (
    window.startAt === decision.executionWindow.startAt &&
    window.endAt === decision.executionWindow.endAt
  );
}

export function matchDecisionForCommand(
  command: CanonicalDeviceCommand,
  decisions: OptimizerDecision[],
): OptimizerDecision | undefined {
  return decisions.find((decision) => {
    const matchesDevice =
      decision.targetDevices?.some((target) => target.deviceId === command.targetDeviceId) ||
      decision.targetDeviceIds.includes(command.targetDeviceId);

    return matchesDevice && windowsMatch(command, decision);
  });
}

/**
 * Build stable request identity for future deduplication and live adapter safety.
 */
export function buildCommandExecutionIdentity(
  planId: string,
  command: CanonicalDeviceCommand,
  decision?: OptimizerDecision,
  opportunityId?: string,
): CommandExecutionIdentity {
  const window = commandWindow(command);
  const targetDeviceId = command.targetDeviceId;
  const decisionId = decision?.decisionId;
  const intent = commandIntentDescriptor(command);
  const startAt = window?.startAt ?? "immediate";
  const endAt = window?.endAt ?? "open";
  const semanticKey = [opportunityId ?? decisionId ?? "unmatched", targetDeviceId, intent, startAt, endAt].join(":");

  return {
    opportunityId,
    executionRequestId: `${planId}:${semanticKey}`,
    idempotencyKey: semanticKey,
    decisionId,
    targetDeviceId,
  };
}
