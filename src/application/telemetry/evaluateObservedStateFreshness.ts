import type {
  DeviceObservedStateFreshness,
  ObservedStateFreshnessStatus,
  ObservedStateFreshnessSummary,
} from "../../domain/observedStateFreshness";
import type { CanonicalDeviceObservedState } from "../../domain/observedDeviceState";

export interface EvaluateObservedStateFreshnessInput {
  now: string;
  knownDeviceIds: string[];
  observedStatesByDeviceId: Record<string, CanonicalDeviceObservedState>;
  maxAgeSeconds?: number;
}

function toMillis(value: string): number {
  return new Date(value).getTime();
}

function deriveOverallStatus(counts: ObservedStateFreshnessSummary["counts"]): ObservedStateFreshnessStatus {
  if (counts.unknown > 0) {
    return "unknown";
  }

  if (counts.missing > 0) {
    return "missing";
  }

  if (counts.stale > 0) {
    return "stale";
  }

  return "fresh";
}

/**
 * Pure freshness evaluation for observed device state at control-input boundary.
 */
export function evaluateObservedStateFreshness(
  input: EvaluateObservedStateFreshnessInput,
): ObservedStateFreshnessSummary {
  const maxAgeSeconds = input.maxAgeSeconds ?? 300;
  const nowMs = toMillis(input.now);

  const counts: ObservedStateFreshnessSummary["counts"] = {
    fresh: 0,
    stale: 0,
    missing: 0,
    unknown: 0,
  };

  const devices: DeviceObservedStateFreshness[] = input.knownDeviceIds.map((deviceId) => {
    const observed = input.observedStatesByDeviceId[deviceId];
    if (!observed) {
      counts.missing += 1;
      return {
        deviceId,
        status: "missing",
      };
    }

    const telemetryMs = toMillis(observed.lastTelemetryAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(telemetryMs) || telemetryMs > nowMs) {
      counts.unknown += 1;
      return {
        deviceId,
        status: "unknown",
        lastTelemetryAt: observed.lastTelemetryAt,
      };
    }

    const ageSeconds = (nowMs - telemetryMs) / 1000;
    if (ageSeconds > maxAgeSeconds) {
      counts.stale += 1;
      return {
        deviceId,
        status: "stale",
        lastTelemetryAt: observed.lastTelemetryAt,
        ageSeconds,
      };
    }

    counts.fresh += 1;
    return {
      deviceId,
      status: "fresh",
      lastTelemetryAt: observed.lastTelemetryAt,
      ageSeconds,
    };
  });

  return {
    capturedAt: input.now,
    maxAgeSeconds,
    overallStatus: deriveOverallStatus(counts),
    counts,
    devices,
  };
}
