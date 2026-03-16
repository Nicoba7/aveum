import { describe, expect, it, vi } from "vitest";
import type { SystemState } from "../domain";
import type { OptimizerDecision, OptimizerOutput } from "../domain/optimizer";
import {
  buildCommandExecutionIdentity,
} from "../application/controlLoopExecution/identity";
import { mapToCanonicalDeviceCommand } from "../application/controlLoopExecution/canonicalCommand";
import { runControlLoopExecutionService } from "../application/controlLoopExecution/service";
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  DeviceCommandExecutor,
} from "../application/controlLoopExecution/types";

function buildSystemState(): SystemState {
  return {
    siteId: "site-1",
    capturedAt: "2026-03-16T10:00:00.000Z",
    timezone: "Europe/London",
    devices: [],
    homeLoadW: 1200,
    solarGenerationW: 800,
    batteryPowerW: 0,
    evChargingPowerW: 0,
    gridPowerW: 400,
  };
}

function buildDecision(windowStart: string, windowEnd: string): OptimizerDecision {
  return {
    decisionId: "decision-1",
    startAt: windowStart,
    endAt: windowEnd,
    executionWindow: { startAt: windowStart, endAt: windowEnd },
    action: "charge_battery",
    targetDeviceIds: ["battery"],
    targetDevices: [
      {
        deviceId: "battery",
        kind: "battery",
        requiredCapabilities: ["set_mode"],
      },
    ],
    reason: "Charge in low-cost slot",
    confidence: 0.8,
  };
}

function buildOutput(options?: {
  decisions?: OptimizerDecision[];
  withCommand?: boolean;
}): OptimizerOutput {
  const decisions = options?.decisions ?? [];
  const withCommand = options?.withCommand ?? false;

  return {
    schemaVersion: "optimizer-output.v1.1",
    plannerVersion: "canonical-runtime.v1",
    planId: "plan-1",
    generatedAt: "2026-03-16T10:00:00.000Z",
    planningWindow: decisions.length
      ? {
        startAt: decisions[0].startAt,
        endAt: decisions[decisions.length - 1].endAt,
      }
      : undefined,
    status: "ok",
    headline: "Test plan",
    decisions,
    recommendedCommands: withCommand
      ? [
        {
          commandId: "cmd-1",
          deviceId: "battery",
          issuedAt: "2026-03-16T10:00:00.000Z",
          type: "set_mode",
          mode: "charge",
          effectiveWindow: {
            startAt: "2026-03-16T10:00:00.000Z",
            endAt: "2026-03-16T10:30:00.000Z",
          },
          reason: "Charge in low-cost slot",
        },
      ]
      : [],
    summary: {
      expectedImportCostPence: 100,
      expectedExportRevenuePence: 20,
      expectedNetValuePence: -80,
    },
    diagnostics: [],
    feasibility: {
      executable: true,
      reasonCodes: ["PLAN_COMPUTED"],
    },
    assumptions: [],
    warnings: [],
    confidence: 0.8,
  };
}

function buildRawCommand(overrides?: Partial<NonNullable<OptimizerOutput["recommendedCommands"]>[number]>) {
  return {
    commandId: "cmd-1",
    deviceId: "battery",
    issuedAt: "2026-03-16T10:00:00.000Z",
    type: "set_mode" as const,
    mode: "charge" as const,
    effectiveWindow: {
      startAt: "2026-03-16T10:00:00.000Z",
      endAt: "2026-03-16T10:30:00.000Z",
    },
    ...overrides,
  };
}

describe("runControlLoopExecutionService", () => {
  it("does not call executor when there are no commands to issue", async () => {
    const execute = vi.fn(async (_requests: CommandExecutionRequest[]) => [] as CommandExecutionResult[]);
    const executor: DeviceCommandExecutor = { execute };

    const result = await runControlLoopExecutionService(
      {
        now: "2026-03-16T10:00:00.000Z",
        systemState: buildSystemState(),
        optimizerOutput: buildOutput(),
      },
      executor,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.executionResults).toEqual([]);
    expect(result.controlLoopResult.commandsToIssue).toEqual([]);
  });

  it("calls executor with canonical requests for active commands", async () => {
    const execute = vi.fn(async (requests: CommandExecutionRequest[]) =>
      requests.map((request) => ({
        executionRequestId: request.executionRequestId,
        requestId: request.requestId,
        idempotencyKey: request.idempotencyKey,
        decisionId: request.decisionId,
        targetDeviceId: request.targetDeviceId,
        commandId: request.commandId,
        deviceId: request.canonicalCommand.targetDeviceId,
        status: "issued" as const,
      })),
    );
    const executor: DeviceCommandExecutor = { execute };

    const result = await runControlLoopExecutionService(
      {
        now: "2026-03-16T10:05:00.000Z",
        systemState: buildSystemState(),
        optimizerOutput: buildOutput({
          decisions: [buildDecision("2026-03-16T10:00:00.000Z", "2026-03-16T10:30:00.000Z")],
          withCommand: true,
        }),
      },
      executor,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    const requests = execute.mock.calls[0][0] as CommandExecutionRequest[];
    expect(requests).toHaveLength(1);
    expect(requests[0].planId).toBe("plan-1");
    expect(requests[0].commandId).toBe("cmd-1");
    expect(requests[0].decisionId).toBe("decision-1");
    expect(requests[0].targetDeviceId).toBe("battery");
    expect(requests[0].canonicalCommand.kind).toBe("set_mode");
    expect(requests[0].canonicalCommand.targetDeviceId).toBe("battery");
    expect("command" in requests[0]).toBe(false);
    expect(requests[0].executionRequestId).toContain("plan-1");
    expect(requests[0].idempotencyKey).toContain("decision-1:battery:set_mode:charge");
    expect(result.controlLoopResult.commandsToIssue).toHaveLength(1);
    expect(result.executionResults[0].status).toBe("issued");
    expect(result.executionResults[0].executionRequestId).toBe(requests[0].executionRequestId);
    expect(result.executionResults[0].idempotencyKey).toBe(requests[0].idempotencyKey);
  });

  it("surfaces executor failures as failed execution results", async () => {
    const execute = vi.fn(async () => {
      throw new Error("Executor offline");
    });
    const executor: DeviceCommandExecutor = { execute };

    const result = await runControlLoopExecutionService(
      {
        now: "2026-03-16T10:05:00.000Z",
        systemState: buildSystemState(),
        optimizerOutput: buildOutput({
          decisions: [buildDecision("2026-03-16T10:00:00.000Z", "2026-03-16T10:30:00.000Z")],
          withCommand: true,
        }),
      },
      executor,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.controlLoopResult.commandsToIssue).toHaveLength(1);
    expect(result.executionResults).toHaveLength(1);
    expect(result.executionResults[0].status).toBe("failed");
    expect(result.executionResults[0].errorCode).toBe("EXECUTOR_ERROR");
    expect(result.executionResults[0].decisionId).toBe("decision-1");
    expect(result.executionResults[0].targetDeviceId).toBe("battery");
  });

  it("builds a stable idempotency key for the same command intent", () => {
    const decision = buildDecision("2026-03-16T10:00:00.000Z", "2026-03-16T10:30:00.000Z");
    const firstCommand = mapToCanonicalDeviceCommand(buildRawCommand());
    const secondCommand = mapToCanonicalDeviceCommand(buildRawCommand({ commandId: "cmd-2", issuedAt: "2026-03-16T09:59:00.000Z" }));

    const first = buildCommandExecutionIdentity("plan-1", firstCommand, decision);
    const second = buildCommandExecutionIdentity("plan-2", secondCommand, decision);

    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.executionRequestId).not.toBe(second.executionRequestId);
  });

  it("changes idempotency key when timing or target changes", () => {
    const decision = buildDecision("2026-03-16T10:00:00.000Z", "2026-03-16T10:30:00.000Z");
    const baseCommand = mapToCanonicalDeviceCommand(buildRawCommand());

    const shiftedCommand = mapToCanonicalDeviceCommand(buildRawCommand({
      effectiveWindow: {
        startAt: "2026-03-16T10:30:00.000Z",
        endAt: "2026-03-16T11:00:00.000Z",
      },
    }));
    const retargetedCommand = mapToCanonicalDeviceCommand(buildRawCommand({
      deviceId: "ev",
    }));
    const semanticChangeCommand = mapToCanonicalDeviceCommand(buildRawCommand({ mode: "discharge" }));

    const baseIdentity = buildCommandExecutionIdentity("plan-1", baseCommand, decision);
    const shiftedIdentity = buildCommandExecutionIdentity("plan-1", shiftedCommand, decision);
    const retargetedIdentity = buildCommandExecutionIdentity("plan-1", retargetedCommand, decision);
    const semanticChangeIdentity = buildCommandExecutionIdentity("plan-1", semanticChangeCommand, decision);

    expect(baseIdentity.idempotencyKey).not.toBe(shiftedIdentity.idempotencyKey);
    expect(baseIdentity.idempotencyKey).not.toBe(retargetedIdentity.idempotencyKey);
    expect(baseIdentity.idempotencyKey).not.toBe(semanticChangeIdentity.idempotencyKey);
  });

  it("maps raw device commands into canonical commands deterministically", () => {
    const raw = buildRawCommand();
    const canonical = mapToCanonicalDeviceCommand(raw);

    expect(canonical).toEqual({
      kind: "set_mode",
      targetDeviceId: "battery",
      effectiveWindow: {
        startAt: "2026-03-16T10:00:00.000Z",
        endAt: "2026-03-16T10:30:00.000Z",
      },
      mode: "charge",
    });
  });
});
