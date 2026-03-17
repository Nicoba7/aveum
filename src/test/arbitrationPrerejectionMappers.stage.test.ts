import { describe, expect, it } from "vitest";
import { mapDeviceArbitrationPrerejections } from "../application/controlLoopExecution/stages/arbitrateDeviceOpportunities";
import { mapHouseholdDecisionPrerejections } from "../application/controlLoopExecution/stages/selectHouseholdDecision";
import type { CommandExecutionRequest } from "../application/controlLoopExecution/types";

const request: CommandExecutionRequest = {
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
};

describe("arbitration prerejection compatibility mappers", () => {
  it("maps device prerejections into canonical and compatibility outputs", () => {
    const mapping = mapDeviceArbitrationPrerejections(
      new Map([
        [
          request.executionRequestId,
          {
            reasonCodes: ["INFERIOR_ECONOMIC_VALUE"],
          },
        ],
      ]),
      new Map([[request.executionRequestId, request]]),
    );

    expect(mapping.rejected).toHaveLength(1);
    expect(mapping.rejected[0].stage).toBe("device_arbitration");
    expect(mapping.compatibilityOutcomes).toHaveLength(1);
    expect(mapping.compatibilityOutcomes[0].reasonCodes).toEqual(["INFERIOR_ECONOMIC_VALUE"]);
  });

  it("maps household prerejections into canonical and compatibility outputs", () => {
    const mapping = mapHouseholdDecisionPrerejections(
      new Map([
        [
          request.executionRequestId,
          {
            reasonCodes: ["INFERIOR_HOUSEHOLD_ECONOMIC_VALUE"],
          },
        ],
      ]),
      new Map([[request.executionRequestId, request]]),
    );

    expect(mapping.rejected).toHaveLength(1);
    expect(mapping.rejected[0].stage).toBe("household_decision");
    expect(mapping.compatibilityOutcomes).toHaveLength(1);
    expect(mapping.compatibilityOutcomes[0].reasonCodes).toEqual(["INFERIOR_HOUSEHOLD_ECONOMIC_VALUE"]);
  });
});
