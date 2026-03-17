import { describe, expect, it, vi } from "vitest";
import { executePlan } from "../application/controlLoopExecution/stages/executePlan";
import type { ExecutablePlan, RejectedOpportunity } from "../application/controlLoopExecution/pipelineTypes";
import type { CommandExecutionRequest, DeviceCommandExecutor } from "../application/controlLoopExecution/types";

const dispatchableRequests: CommandExecutionRequest[] = [
  {
    opportunityId: "opp-1",
    executionRequestId: "req-1",
    requestId: "req-1",
    idempotencyKey: "idem-1",
    decisionId: "decision-1",
    targetDeviceId: "battery",
    planId: "plan-1",
    requestedAt: "2026-03-16T10:05:00.000Z",
    commandId: "cmd-1",
    canonicalCommand: {
      kind: "set_mode",
      targetDeviceId: "battery",
      mode: "charge",
    },
  },
];

const plan: ExecutablePlan = {
  kind: "executable",
  householdDecision: {
    kind: "selected_opportunity",
    selectedOpportunity: {
      opportunityId: "opp-1",
      decisionId: "decision-1",
      targetDeviceId: "battery",
      eligible: {
        opportunityId: "opp-1",
        decisionId: "decision-1",
        targetDeviceId: "battery",
        request: dispatchableRequests[0],
        eligibilityBasis: {
          runtimeGuardrailPassed: true,
          capabilityValidationPassed: true,
          reconciliationPassed: true,
          executionPolicyPassed: true,
          observedStateStatus: "fresh",
        },
      },
      deviceArbitration: {
        arbitrationScope: "device",
        deviceContentionKey: "battery",
        alternativesConsidered: 1,
        decisionReason: "selected",
      },
    },
    rejectedOpportunities: [],
    decisionReason: "selected",
  },
  selectedOpportunityId: "opp-1",
  selectedDecisionId: "decision-1",
  commands: [dispatchableRequests[0].canonicalCommand],
};

const rejected: RejectedOpportunity[] = [
  {
    opportunityId: "opp-r-1",
    decisionId: "decision-r-1",
    targetDeviceId: "ev",
    stage: "execution_planning",
    reasonCodes: ["CONFLICTING_COMMAND_FOR_DEVICE"],
    decisionReason: "Conflict",
  },
];

describe("executePlan stage", () => {
  it("preserves selectedOpportunityId and returns executed result", async () => {
    const executor: DeviceCommandExecutor = {
      execute: vi.fn(async (requests) =>
        requests.map((request) => ({
          opportunityId: request.opportunityId,
          executionRequestId: request.executionRequestId,
          requestId: request.requestId,
          idempotencyKey: request.idempotencyKey,
          decisionId: request.decisionId,
          targetDeviceId: request.targetDeviceId,
          commandId: request.commandId,
          deviceId: request.targetDeviceId,
          status: "issued" as const,
        })),
      ),
    };

    const output = await executePlan({
      plan,
      dispatchableRequests,
      executor,
      preExecutionOutcomes: [],
      selectedEconomicTraces: new Map(),
      executionPosture: "normal",
      rejectedOpportunities: rejected,
    });

    expect(output.execution.kind).toBe("executed");
    expect(output.execution.selectedOpportunityId).toBe("opp-1");
    expect(output.execution.rejectedOpportunities).toEqual(rejected);
  });

  it("returns non_executed result for non-executable plan", async () => {
    const executor: DeviceCommandExecutor = {
      execute: vi.fn(async () => []),
    };

    const output = await executePlan({
      plan: {
        kind: "non_executable",
        householdDecision: {
          kind: "no_action",
          rejectedOpportunities: rejected,
          reasonCodes: ["EXECUTION_PLAN_EMPTY_COMMAND_SET"],
          decisionReason: "No executable commands remained after execution planning.",
        },
        reasonCodes: ["EXECUTION_PLAN_EMPTY_COMMAND_SET"],
        decisionReason: "No executable commands remained after execution planning.",
        commands: [],
      },
      dispatchableRequests: [],
      executor,
      preExecutionOutcomes: [],
      selectedEconomicTraces: new Map(),
      executionPosture: "normal",
      rejectedOpportunities: rejected,
    });

    expect(output.execution.kind).toBe("non_executed");
    expect(output.execution.rejectedOpportunities).toEqual(rejected);
  });
});
