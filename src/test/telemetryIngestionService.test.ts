import { describe, expect, it } from "vitest";
import type { CanonicalDeviceTelemetry } from "../domain/telemetry";
import { InMemoryObservedDeviceStateStore } from "../observed/observedDeviceStateStore";
import { ingestCanonicalTelemetry } from "../application/telemetry/ingestionService";

function telemetryEvent(overrides?: Partial<CanonicalDeviceTelemetry>): CanonicalDeviceTelemetry {
  return {
    deviceId: "battery",
    timestamp: "2026-03-16T10:00:00.000Z",
    schemaVersion: "telemetry.v1",
    ...overrides,
  };
}

describe("ingestCanonicalTelemetry", () => {
  it("ingests telemetry and writes observed state", () => {
    const store = new InMemoryObservedDeviceStateStore();

    const result = ingestCanonicalTelemetry(
      [telemetryEvent({ batterySocPercent: 64, batteryPowerW: -1500 })],
      store,
    );

    expect(result.ingestedCount).toBe(1);
    expect(result.updatedStates).toHaveLength(1);
    expect(result.acceptedCount).toBe(1);
    expect(result.ignoredStaleCount).toBe(0);
    expect(result.ignoredDuplicateCount).toBe(0);
    expect(result.rejectedInvalidCount).toBe(0);
    expect(result.outcomes[0].status).toBe("accepted");
    const stored = store.getDeviceState("battery");
    expect(stored?.batterySocPercent).toBe(64);
    expect(stored?.batteryPowerW).toBe(-1500);
    expect(stored?.chargingState).toBe("charging");
  });

  it("updates existing observed state deterministically", () => {
    const store = new InMemoryObservedDeviceStateStore();
    ingestCanonicalTelemetry([telemetryEvent({ batterySocPercent: 60, solarGenerationW: 500 })], store);

    ingestCanonicalTelemetry(
      [telemetryEvent({ timestamp: "2026-03-16T10:05:00.000Z", gridImportPowerW: 700 })],
      store,
    );

    const stored = store.getDeviceState("battery");
    expect(stored?.lastTelemetryAt).toBe("2026-03-16T10:05:00.000Z");
    expect(stored?.batterySocPercent).toBe(60);
    expect(stored?.solarGenerationW).toBe(500);
    expect(stored?.gridImportPowerW).toBe(700);
  });

  it("ignores stale and duplicate telemetry and rejects invalid telemetry", () => {
    const store = new InMemoryObservedDeviceStateStore();
    ingestCanonicalTelemetry(
      [telemetryEvent({ timestamp: "2026-03-16T10:05:00.000Z", batterySocPercent: 61 })],
      store,
    );

    const result = ingestCanonicalTelemetry(
      [
        telemetryEvent({ timestamp: "2026-03-16T10:04:00.000Z", batterySocPercent: 58 }),
        telemetryEvent({ timestamp: "2026-03-16T10:05:00.000Z", batterySocPercent: 62 }),
        telemetryEvent({ deviceId: "", timestamp: "2026-03-16T10:06:00.000Z" }),
      ],
      store,
    );

    expect(result.acceptedCount).toBe(0);
    expect(result.ignoredStaleCount).toBe(1);
    expect(result.ignoredDuplicateCount).toBe(1);
    expect(result.rejectedInvalidCount).toBe(1);
    expect(result.outcomes.map((entry) => entry.status)).toEqual([
      "ignored_stale",
      "ignored_duplicate",
      "rejected_invalid",
    ]);

    const stored = store.getDeviceState("battery");
    expect(stored?.batterySocPercent).toBe(61);
    expect(stored?.lastTelemetryAt).toBe("2026-03-16T10:05:00.000Z");
  });
});
