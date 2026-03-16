import { describe, expect, it } from "vitest";
import type { CanonicalDeviceObservedState } from "../domain/observedDeviceState";
import type { CanonicalDeviceTelemetry } from "../domain/telemetry";
import { projectTelemetryToObservedState } from "../application/telemetry/projectTelemetryToObservedState";

function buildTelemetry(overrides?: Partial<CanonicalDeviceTelemetry>): CanonicalDeviceTelemetry {
  return {
    deviceId: "battery",
    timestamp: "2026-03-16T10:00:00.000Z",
    schemaVersion: "telemetry.v1",
    ...overrides,
  };
}

function buildObserved(overrides?: Partial<CanonicalDeviceObservedState>): CanonicalDeviceObservedState {
  return {
    deviceId: "battery",
    lastTelemetryAt: "2026-03-16T09:55:00.000Z",
    batterySocPercent: 55,
    batteryPowerW: 1200,
    chargingState: "discharging",
    evConnected: false,
    solarGenerationW: 900,
    gridImportPowerW: 300,
    gridExportPowerW: 0,
    stateSource: "telemetry_projection",
    schemaVersion: "device-observed-state.v1",
    ...overrides,
  };
}

describe("projectTelemetryToObservedState", () => {
  it("projects telemetry into a canonical observed state", () => {
    const projected = projectTelemetryToObservedState(
      undefined,
      buildTelemetry({ batterySocPercent: 61, batteryPowerW: -1800, evConnected: true }),
    );

    expect(projected.deviceId).toBe("battery");
    expect(projected.lastTelemetryAt).toBe("2026-03-16T10:00:00.000Z");
    expect(projected.batterySocPercent).toBe(61);
    expect(projected.batteryPowerW).toBe(-1800);
    expect(projected.chargingState).toBe("charging");
    expect(projected.evConnected).toBe(true);
    expect(projected.schemaVersion).toBe("device-observed-state.v1");
  });

  it("preserves prior values when incoming telemetry omits fields", () => {
    const projected = projectTelemetryToObservedState(
      buildObserved(),
      buildTelemetry({ timestamp: "2026-03-16T10:05:00.000Z" }),
    );

    expect(projected.lastTelemetryAt).toBe("2026-03-16T10:05:00.000Z");
    expect(projected.batterySocPercent).toBe(55);
    expect(projected.batteryPowerW).toBe(1200);
    expect(projected.solarGenerationW).toBe(900);
    expect(projected.gridImportPowerW).toBe(300);
    expect(projected.chargingState).toBe("discharging");
  });

  it("derives charging state from EV charging power when available", () => {
    const projected = projectTelemetryToObservedState(
      buildObserved({ chargingState: "unknown" }),
      buildTelemetry({ evChargingPowerW: 3200 }),
    );

    expect(projected.chargingState).toBe("charging");
  });
});
