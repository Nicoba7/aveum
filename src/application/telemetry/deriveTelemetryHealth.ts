import type { ObservedStateFreshnessSummary } from "../../domain/observedStateFreshness";
import type {
  DeviceTelemetryHealth,
  TelemetryHealthReasonCode,
  TelemetryHealthSummary,
} from "../../domain/telemetryHealth";
import type { TelemetryIngestionOutcome } from "./ingestionService";

export interface DeriveTelemetryHealthInput {
  freshness: ObservedStateFreshnessSummary;
  recentIngestionOutcomes?: TelemetryIngestionOutcome[];
}

function deriveOverallStatus(counts: TelemetryHealthSummary["counts"]): TelemetryHealthSummary["overallStatus"] {
  if (counts.unknown > 0) {
    return "unknown";
  }

  if (counts.unavailable > 0) {
    return "unavailable";
  }

  if (counts.degraded > 0) {
    return "degraded";
  }

  return "healthy";
}

function invalidTelemetryCountByDevice(
  outcomes: TelemetryIngestionOutcome[] | undefined,
): Record<string, number> {
  if (!outcomes?.length) {
    return {};
  }

  return outcomes.reduce<Record<string, number>>((acc, outcome) => {
    if (outcome.status === "rejected_invalid") {
      acc[outcome.deviceId] = (acc[outcome.deviceId] ?? 0) + 1;
    }

    return acc;
  }, {});
}

/**
 * Pure telemetry health derivation from existing safety signals.
 */
export function deriveTelemetryHealth(input: DeriveTelemetryHealthInput): TelemetryHealthSummary {
  const invalidCounts = invalidTelemetryCountByDevice(input.recentIngestionOutcomes);

  const counts: TelemetryHealthSummary["counts"] = {
    healthy: 0,
    degraded: 0,
    unavailable: 0,
    unknown: 0,
  };

  const devices: DeviceTelemetryHealth[] = input.freshness.devices.map((deviceFreshness) => {
    const invalidCount = invalidCounts[deviceFreshness.deviceId] ?? 0;
    const reasons: TelemetryHealthReasonCode[] = [];

    if (deviceFreshness.status === "missing") {
      counts.unavailable += 1;
      reasons.push("OBSERVED_STATE_MISSING", "INSUFFICIENT_OBSERVED_DATA");
      return {
        deviceId: deviceFreshness.deviceId,
        status: "unavailable",
        reasonCodes: reasons,
        invalidTelemetryCount: invalidCount || undefined,
      };
    }

    if (deviceFreshness.status === "unknown") {
      counts.unknown += 1;
      reasons.push("OBSERVED_STATE_UNKNOWN", "INSUFFICIENT_OBSERVED_DATA");
      return {
        deviceId: deviceFreshness.deviceId,
        status: "unknown",
        reasonCodes: reasons,
        lastTelemetryAt: deviceFreshness.lastTelemetryAt,
        invalidTelemetryCount: invalidCount || undefined,
      };
    }

    if (deviceFreshness.status === "stale") {
      counts.degraded += 1;
      reasons.push("OBSERVED_STATE_STALE");

      if (invalidCount > 0) {
        reasons.push("INVALID_TELEMETRY_HISTORY");
      }

      return {
        deviceId: deviceFreshness.deviceId,
        status: "degraded",
        reasonCodes: reasons,
        lastTelemetryAt: deviceFreshness.lastTelemetryAt,
        ageSeconds: deviceFreshness.ageSeconds,
        invalidTelemetryCount: invalidCount || undefined,
      };
    }

    if (invalidCount > 0) {
      counts.degraded += 1;
      return {
        deviceId: deviceFreshness.deviceId,
        status: "degraded",
        reasonCodes: ["INVALID_TELEMETRY_HISTORY"],
        lastTelemetryAt: deviceFreshness.lastTelemetryAt,
        ageSeconds: deviceFreshness.ageSeconds,
        invalidTelemetryCount: invalidCount,
      };
    }

    counts.healthy += 1;
    return {
      deviceId: deviceFreshness.deviceId,
      status: "healthy",
      reasonCodes: ["TELEMETRY_HEALTHY"],
      lastTelemetryAt: deviceFreshness.lastTelemetryAt,
      ageSeconds: deviceFreshness.ageSeconds,
    };
  });

  return {
    capturedAt: input.freshness.capturedAt,
    overallStatus: deriveOverallStatus(counts),
    counts,
    devices,
  };
}
