import { describe, expect, it } from "vitest";
import { deriveTelemetryHealth } from "../application/telemetry/deriveTelemetryHealth";

describe("deriveTelemetryHealth", () => {
  it("derives healthy when freshness is fresh and no invalid telemetry outcomes", () => {
    const health = deriveTelemetryHealth({
      freshness: {
        capturedAt: "2026-03-16T10:05:00.000Z",
        maxAgeSeconds: 300,
        overallStatus: "fresh",
        counts: { fresh: 1, stale: 0, missing: 0, unknown: 0 },
        devices: [
          {
            deviceId: "battery",
            status: "fresh",
            lastTelemetryAt: "2026-03-16T10:04:00.000Z",
            ageSeconds: 60,
          },
        ],
      },
    });

    expect(health.overallStatus).toBe("healthy");
    expect(health.counts.healthy).toBe(1);
    expect(health.devices[0].reasonCodes).toEqual(["TELEMETRY_HEALTHY"]);
  });

  it("derives unavailable for missing observed state", () => {
    const health = deriveTelemetryHealth({
      freshness: {
        capturedAt: "2026-03-16T10:05:00.000Z",
        maxAgeSeconds: 300,
        overallStatus: "missing",
        counts: { fresh: 0, stale: 0, missing: 1, unknown: 0 },
        devices: [{ deviceId: "battery", status: "missing" }],
      },
    });

    expect(health.overallStatus).toBe("unavailable");
    expect(health.devices[0].reasonCodes).toEqual([
      "OBSERVED_STATE_MISSING",
      "INSUFFICIENT_OBSERVED_DATA",
    ]);
  });

  it("derives degraded from stale freshness", () => {
    const health = deriveTelemetryHealth({
      freshness: {
        capturedAt: "2026-03-16T10:05:00.000Z",
        maxAgeSeconds: 60,
        overallStatus: "stale",
        counts: { fresh: 0, stale: 1, missing: 0, unknown: 0 },
        devices: [
          {
            deviceId: "battery",
            status: "stale",
            lastTelemetryAt: "2026-03-16T10:00:00.000Z",
            ageSeconds: 300,
          },
        ],
      },
    });

    expect(health.overallStatus).toBe("degraded");
    expect(health.devices[0].reasonCodes).toContain("OBSERVED_STATE_STALE");
  });

  it("derives unknown for unknown freshness", () => {
    const health = deriveTelemetryHealth({
      freshness: {
        capturedAt: "2026-03-16T10:05:00.000Z",
        maxAgeSeconds: 60,
        overallStatus: "unknown",
        counts: { fresh: 0, stale: 0, missing: 0, unknown: 1 },
        devices: [
          {
            deviceId: "battery",
            status: "unknown",
            lastTelemetryAt: "invalid-ts",
          },
        ],
      },
    });

    expect(health.overallStatus).toBe("unknown");
    expect(health.devices[0].reasonCodes).toContain("OBSERVED_STATE_UNKNOWN");
  });

  it("derives degraded when recent ingestion has invalid telemetry history", () => {
    const health = deriveTelemetryHealth({
      freshness: {
        capturedAt: "2026-03-16T10:05:00.000Z",
        maxAgeSeconds: 300,
        overallStatus: "fresh",
        counts: { fresh: 1, stale: 0, missing: 0, unknown: 0 },
        devices: [{ deviceId: "battery", status: "fresh" }],
      },
      recentIngestionOutcomes: [
        {
          deviceId: "battery",
          timestamp: "2026-03-16T10:04:30.000Z",
          status: "rejected_invalid",
          reasonCode: "INVALID_TIMESTAMP",
        },
      ],
    });

    expect(health.overallStatus).toBe("degraded");
    expect(health.devices[0].reasonCodes).toEqual(["INVALID_TELEMETRY_HISTORY"]);
    expect(health.devices[0].invalidTelemetryCount).toBe(1);
  });
});
