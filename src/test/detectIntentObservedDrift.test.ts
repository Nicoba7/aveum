import { describe, expect, it } from "vitest";
import type { CanonicalDeviceObservedState } from "../domain/observedDeviceState";
import type { CanonicalDeviceShadowState } from "../shadow/deviceShadow";
import { detectIntentObservedDrift } from "../application/telemetry/detectIntentObservedDrift";

function shadow(overrides?: Partial<CanonicalDeviceShadowState>): CanonicalDeviceShadowState {
  return {
    deviceId: "battery",
    lastKnownCommand: {
      kind: "set_mode",
      targetDeviceId: "battery",
      mode: "charge",
      effectiveWindow: {
        startAt: "2026-03-16T10:00:00.000Z",
        endAt: "2026-03-16T10:30:00.000Z",
      },
    },
    lastKnownMode: "charge",
    lastKnownPowerW: 3000,
    lastUpdatedAt: "2026-03-16T10:00:00.000Z",
    stateSource: "execution_result",
    schemaVersion: "device-shadow.v1",
    ...overrides,
  };
}

function observed(overrides?: Partial<CanonicalDeviceObservedState>): CanonicalDeviceObservedState {
  return {
    deviceId: "battery",
    lastTelemetryAt: "2026-03-16T10:01:00.000Z",
    chargingState: "charging",
    batteryPowerW: 2800,
    stateSource: "telemetry_projection",
    schemaVersion: "device-observed-state.v1",
    ...overrides,
  };
}

describe("detectIntentObservedDrift", () => {
  it("returns in_sync when charging intent matches observed charging state", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow({ lastKnownPowerW: undefined }),
      observed: observed({ chargingState: "charging", batteryPowerW: undefined }),
    });

    expect(result.outcome).toBe("in_sync");
    expect(result.reasonCodes).toEqual(["INTENT_OBSERVED_SYNC"]);
  });

  it("returns drift_detected when charging intent disagrees with observed charging state", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow({ lastKnownPowerW: undefined }),
      observed: observed({ chargingState: "discharging", batteryPowerW: undefined }),
    });

    expect(result.outcome).toBe("drift_detected");
    expect(result.reasonCodes).toContain("CHARGING_STATE_MISMATCH");
  });

  it("returns drift_detected when observed power exceeds intended power limit", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow({
        lastKnownCommand: {
          kind: "set_power_limit",
          targetDeviceId: "battery",
          powerW: 3000,
        },
        lastKnownPowerW: 3000,
        lastKnownMode: undefined,
      }),
      observed: observed({ batteryPowerW: 3600, chargingState: "charging" }),
      powerToleranceW: 100,
    });

    expect(result.outcome).toBe("drift_detected");
    expect(result.reasonCodes).toContain("POWER_LIMIT_EXCEEDED");
  });

  it("returns insufficient_observed_data when observed state is missing", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow(),
      observed: undefined,
    });

    expect(result.outcome).toBe("insufficient_observed_data");
    expect(result.reasonCodes).toEqual(["NO_OBSERVED_STATE"]);
  });

  it("returns insufficient_observed_data when charging state is required but missing", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow({ lastKnownPowerW: undefined }),
      observed: observed({ chargingState: undefined, batteryPowerW: undefined }),
    });

    expect(result.outcome).toBe("insufficient_observed_data");
    expect(result.reasonCodes).toEqual(["OBSERVED_CHARGING_STATE_MISSING"]);
  });

  it("returns not_comparable when intent mode cannot be compared in first version", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow({
        lastKnownMode: "eco",
        lastKnownCommand: {
          kind: "set_mode",
          targetDeviceId: "battery",
          mode: "eco",
        },
        lastKnownPowerW: undefined,
      }),
      observed: observed({ batteryPowerW: undefined }),
    });

    expect(result.outcome).toBe("not_comparable");
    expect(result.reasonCodes).toEqual(["MODE_COMPARISON_NOT_SUPPORTED"]);
  });

  it("returns not_comparable for unsupported intent kinds", () => {
    const result = detectIntentObservedDrift({
      now: "2026-03-16T10:05:00.000Z",
      shadow: shadow({
        lastKnownCommand: {
          kind: "refresh_state",
          targetDeviceId: "battery",
        },
        lastKnownMode: undefined,
        lastKnownPowerW: undefined,
      }),
      observed: observed({ batteryPowerW: undefined }),
    });

    expect(result.outcome).toBe("not_comparable");
    expect(result.reasonCodes).toEqual(["INTENT_KIND_NOT_SUPPORTED"]);
  });
});
