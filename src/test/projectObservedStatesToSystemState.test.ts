import { describe, expect, it } from "vitest";
import type { CanonicalDeviceObservedState } from "../domain/observedDeviceState";
import { projectObservedStatesToSystemState } from "../application/telemetry/projectObservedStatesToSystemState";

function observed(overrides?: Partial<CanonicalDeviceObservedState>): CanonicalDeviceObservedState {
  return {
    deviceId: "battery",
    lastTelemetryAt: "2026-03-16T10:00:00.000Z",
    batterySocPercent: 60,
    batteryPowerW: -1200,
    evChargingPowerW: 0,
    evConnected: false,
    solarGenerationW: 800,
    gridImportPowerW: 1000,
    gridExportPowerW: 0,
    chargingState: "charging",
    stateSource: "telemetry_projection",
    schemaVersion: "device-observed-state.v1",
    ...overrides,
  };
}

describe("projectObservedStatesToSystemState", () => {
  it("aggregates observed telemetry into canonical system state", () => {
    const systemState = projectObservedStatesToSystemState({
      siteId: "site-1",
      capturedAt: "2026-03-16T10:05:00.000Z",
      timezone: "Europe/London",
      devices: [],
      observedStates: [
        observed(),
        observed({
          deviceId: "ev",
          batterySocPercent: undefined,
          batteryPowerW: 0,
          evChargingPowerW: 3200,
          evConnected: true,
          solarGenerationW: 0,
          gridImportPowerW: 2500,
        }),
      ],
    });

    expect(systemState.solarGenerationW).toBe(800);
    expect(systemState.batteryPowerW).toBe(-1200);
    expect(systemState.evChargingPowerW).toBe(3200);
    expect(systemState.gridPowerW).toBe(3500);
    expect(systemState.batterySocPercent).toBe(60);
    expect(systemState.evConnected).toBe(true);
  });

  it("returns zeroed aggregates when no observed states are present", () => {
    const systemState = projectObservedStatesToSystemState({
      siteId: "site-1",
      capturedAt: "2026-03-16T10:05:00.000Z",
      timezone: "Europe/London",
      devices: [],
      observedStates: [],
    });

    expect(systemState.solarGenerationW).toBe(0);
    expect(systemState.batteryPowerW).toBe(0);
    expect(systemState.evChargingPowerW).toBe(0);
    expect(systemState.gridPowerW).toBe(0);
    expect(systemState.batterySocPercent).toBeUndefined();
    expect(systemState.evConnected).toBe(false);
  });
});
