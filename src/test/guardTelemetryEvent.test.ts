import { describe, expect, it } from "vitest";
import type { CanonicalDeviceObservedState } from "../domain/observedDeviceState";
import type { CanonicalDeviceTelemetry } from "../domain/telemetry";
import { guardTelemetryEvent } from "../application/telemetry/guardTelemetryEvent";

function telemetry(overrides?: Partial<CanonicalDeviceTelemetry>): CanonicalDeviceTelemetry {
  return {
    deviceId: "battery",
    timestamp: "2026-03-16T10:05:00.000Z",
    schemaVersion: "telemetry.v1",
    ...overrides,
  };
}

function observed(overrides?: Partial<CanonicalDeviceObservedState>): CanonicalDeviceObservedState {
  return {
    deviceId: "battery",
    lastTelemetryAt: "2026-03-16T10:00:00.000Z",
    stateSource: "telemetry_projection",
    schemaVersion: "device-observed-state.v1",
    ...overrides,
  };
}

describe("guardTelemetryEvent", () => {
  it("rejects telemetry missing device identity", () => {
    const decision = guardTelemetryEvent(telemetry({ deviceId: " " }), undefined);

    expect(decision.status).toBe("rejected_invalid");
    expect(decision.reasonCode).toBe("MISSING_DEVICE_ID");
  });

  it("rejects telemetry missing timestamp", () => {
    const decision = guardTelemetryEvent(telemetry({ timestamp: "" }), undefined);

    expect(decision.status).toBe("rejected_invalid");
    expect(decision.reasonCode).toBe("MISSING_TIMESTAMP");
  });

  it("ignores stale telemetry older than observed state", () => {
    const decision = guardTelemetryEvent(
      telemetry({ timestamp: "2026-03-16T09:59:00.000Z" }),
      observed({ lastTelemetryAt: "2026-03-16T10:00:00.000Z" }),
    );

    expect(decision.status).toBe("ignored_stale");
    expect(decision.reasonCode).toBe("STALE_TIMESTAMP");
  });

  it("ignores duplicate telemetry with same timestamp", () => {
    const decision = guardTelemetryEvent(
      telemetry({ timestamp: "2026-03-16T10:00:00.000Z" }),
      observed({ lastTelemetryAt: "2026-03-16T10:00:00.000Z" }),
    );

    expect(decision.status).toBe("ignored_duplicate");
    expect(decision.reasonCode).toBe("DUPLICATE_TIMESTAMP");
  });

  it("accepts fresh telemetry newer than observed state", () => {
    const decision = guardTelemetryEvent(
      telemetry({ timestamp: "2026-03-16T10:06:00.000Z" }),
      observed({ lastTelemetryAt: "2026-03-16T10:00:00.000Z" }),
    );

    expect(decision.status).toBe("accepted");
    expect(decision.reasonCode).toBe("VALID");
  });
});
