import type { CanonicalDeviceObservedState } from "../../domain/observedDeviceState";
import type { CanonicalDeviceTelemetry } from "../../domain/telemetry";

export type TelemetryGuardStatus =
  | "accepted"
  | "ignored_stale"
  | "ignored_duplicate"
  | "rejected_invalid";

export type TelemetryGuardReasonCode =
  | "MISSING_DEVICE_ID"
  | "MISSING_TIMESTAMP"
  | "INVALID_TIMESTAMP"
  | "STALE_TIMESTAMP"
  | "DUPLICATE_TIMESTAMP"
  | "VALID";

export interface TelemetryGuardDecision {
  status: TelemetryGuardStatus;
  reasonCode: TelemetryGuardReasonCode;
}

function toMillis(timestamp: string): number {
  return new Date(timestamp).getTime();
}

/**
 * Pure telemetry freshness and ordering guard.
 */
export function guardTelemetryEvent(
  telemetry: CanonicalDeviceTelemetry,
  existing: CanonicalDeviceObservedState | undefined,
): TelemetryGuardDecision {
  const deviceId = telemetry.deviceId?.trim();
  if (!deviceId) {
    return {
      status: "rejected_invalid",
      reasonCode: "MISSING_DEVICE_ID",
    };
  }

  const timestamp = telemetry.timestamp?.trim();
  if (!timestamp) {
    return {
      status: "rejected_invalid",
      reasonCode: "MISSING_TIMESTAMP",
    };
  }

  const eventMs = toMillis(timestamp);
  if (!Number.isFinite(eventMs)) {
    return {
      status: "rejected_invalid",
      reasonCode: "INVALID_TIMESTAMP",
    };
  }

  if (!existing) {
    return {
      status: "accepted",
      reasonCode: "VALID",
    };
  }

  const existingMs = toMillis(existing.lastTelemetryAt);
  if (!Number.isFinite(existingMs)) {
    return {
      status: "accepted",
      reasonCode: "VALID",
    };
  }

  if (eventMs < existingMs) {
    return {
      status: "ignored_stale",
      reasonCode: "STALE_TIMESTAMP",
    };
  }

  if (eventMs === existingMs) {
    return {
      status: "ignored_duplicate",
      reasonCode: "DUPLICATE_TIMESTAMP",
    };
  }

  return {
    status: "accepted",
    reasonCode: "VALID",
  };
}
