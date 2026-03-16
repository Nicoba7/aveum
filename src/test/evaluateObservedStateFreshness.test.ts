import { describe, expect, it } from "vitest";
import type { CanonicalDeviceObservedState } from "../domain/observedDeviceState";
import { evaluateObservedStateFreshness } from "../application/telemetry/evaluateObservedStateFreshness";

function observed(overrides?: Partial<CanonicalDeviceObservedState>): CanonicalDeviceObservedState {
  return {
    deviceId: "battery",
    lastTelemetryAt: "2026-03-16T10:00:00.000Z",
    stateSource: "telemetry_projection",
    schemaVersion: "device-observed-state.v1",
    ...overrides,
  };
}

describe("evaluateObservedStateFreshness", () => {
  it("marks device as fresh within max age", () => {
    const summary = evaluateObservedStateFreshness({
      now: "2026-03-16T10:04:00.000Z",
      knownDeviceIds: ["battery"],
      observedStatesByDeviceId: {
        battery: observed({ deviceId: "battery", lastTelemetryAt: "2026-03-16T10:00:30.000Z" }),
      },
      maxAgeSeconds: 300,
    });

    expect(summary.overallStatus).toBe("fresh");
    expect(summary.counts.fresh).toBe(1);
    expect(summary.devices[0].status).toBe("fresh");
  });

  it("marks device as stale when age exceeds max age", () => {
    const summary = evaluateObservedStateFreshness({
      now: "2026-03-16T10:10:00.000Z",
      knownDeviceIds: ["battery"],
      observedStatesByDeviceId: {
        battery: observed({ deviceId: "battery", lastTelemetryAt: "2026-03-16T10:00:00.000Z" }),
      },
      maxAgeSeconds: 60,
    });

    expect(summary.overallStatus).toBe("stale");
    expect(summary.counts.stale).toBe(1);
    expect(summary.devices[0].status).toBe("stale");
  });

  it("marks device as missing when no observed state is available", () => {
    const summary = evaluateObservedStateFreshness({
      now: "2026-03-16T10:10:00.000Z",
      knownDeviceIds: ["battery"],
      observedStatesByDeviceId: {},
      maxAgeSeconds: 300,
    });

    expect(summary.overallStatus).toBe("missing");
    expect(summary.counts.missing).toBe(1);
    expect(summary.devices[0].status).toBe("missing");
  });

  it("marks device as unknown when observed timestamp is invalid", () => {
    const summary = evaluateObservedStateFreshness({
      now: "2026-03-16T10:10:00.000Z",
      knownDeviceIds: ["battery"],
      observedStatesByDeviceId: {
        battery: observed({ deviceId: "battery", lastTelemetryAt: "not-a-time" }),
      },
      maxAgeSeconds: 300,
    });

    expect(summary.overallStatus).toBe("unknown");
    expect(summary.counts.unknown).toBe(1);
    expect(summary.devices[0].status).toBe("unknown");
  });
});
