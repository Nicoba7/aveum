import { describe, expect, it } from "vitest";
import { generateDecisionExplanation } from "../application/controlLoopExecution/generateDecisionExplanation";

describe("generateDecisionExplanation", () => {
  it("renders user-readable selected decision explanations from canonical fields", () => {
    const explanation = generateDecisionExplanation(
      {
        opportunityId: "opp-1",
        decisionType: "charge_battery",
        decisionReason: "Charge EV in low-cost slot",
        planningConfidenceLevel: "medium",
        economicSignals: {
          effectiveStoredEnergyValuePencePerKwh: 8,
          marginalImportAvoidancePencePerKwh: 6.5,
        },
      },
      { executionPosture: "normal" },
    );

    expect(explanation.summary).toBe("Charging battery");
    expect(explanation.drivers).toEqual([
      "Charge EV in low-cost slot.",
      "Current planning confidence is medium.",
      "Stored energy is worth 8.00 p/kWh right now.",
      "Avoiding grid imports is worth 6.50 p/kWh right now.",
    ]);
    expect(explanation.confidence_reason).toBe("Current planning confidence is medium.");
  });

  it("renders user-readable rejected decision explanations without debug-style labels", () => {
    const explanation = generateDecisionExplanation(
      {
        opportunityId: "opp-2",
        decisionType: "rejected_preflight_validation",
        reasonCodes: ["CAPABILITIES_NOT_FOUND"],
      },
      { executionPosture: "hold_only" },
    );

    expect(explanation.summary).toBe("Not acting right now");
    expect(explanation.drivers).toEqual([
      "Current constraints still apply: capabilities not found.",
      "Runtime posture is hold only.",
    ]);
    expect(explanation.caution).toBe("CAPABILITIES_NOT_FOUND");
  });
});
