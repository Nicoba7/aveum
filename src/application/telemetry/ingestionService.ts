import type { CanonicalDeviceObservedState } from "../../domain/observedDeviceState";
import type { CanonicalDeviceTelemetry } from "../../domain/telemetry";
import type { ObservedDeviceStateStore } from "../../observed/observedDeviceStateStore";
import type { TelemetryGuardReasonCode, TelemetryGuardStatus } from "./guardTelemetryEvent";
import { guardTelemetryEvent } from "./guardTelemetryEvent";
import { projectTelemetryToObservedState } from "./projectTelemetryToObservedState";

export interface TelemetryIngestionOutcome {
  deviceId: string;
  timestamp: string;
  status: TelemetryGuardStatus;
  reasonCode: TelemetryGuardReasonCode;
}

export interface TelemetryIngestionResult {
  ingestedCount: number;
  updatedStates: CanonicalDeviceObservedState[];
  outcomes: TelemetryIngestionOutcome[];
  acceptedCount: number;
  ignoredStaleCount: number;
  ignoredDuplicateCount: number;
  rejectedInvalidCount: number;
}

/**
 * Application-layer telemetry ingestion seam.
 */
export function ingestCanonicalTelemetry(
  telemetryEvents: CanonicalDeviceTelemetry[],
  store: ObservedDeviceStateStore,
): TelemetryIngestionResult {
  const updatedStates: CanonicalDeviceObservedState[] = [];
  const outcomes: TelemetryIngestionOutcome[] = [];

  let acceptedCount = 0;
  let ignoredStaleCount = 0;
  let ignoredDuplicateCount = 0;
  let rejectedInvalidCount = 0;

  telemetryEvents.forEach((event) => {
    const existing = store.getDeviceState(event.deviceId);
    const decision = guardTelemetryEvent(event, existing);

    outcomes.push({
      deviceId: event.deviceId,
      timestamp: event.timestamp,
      status: decision.status,
      reasonCode: decision.reasonCode,
    });

    if (decision.status === "rejected_invalid") {
      rejectedInvalidCount += 1;
      return;
    }

    if (decision.status === "ignored_stale") {
      ignoredStaleCount += 1;
      return;
    }

    if (decision.status === "ignored_duplicate") {
      ignoredDuplicateCount += 1;
      return;
    }

    const projected = projectTelemetryToObservedState(existing, event);
    store.setDeviceState(event.deviceId, projected);
    updatedStates.push(projected);
    acceptedCount += 1;
  });

  return {
    ingestedCount: telemetryEvents.length,
    updatedStates,
    outcomes,
    acceptedCount,
    ignoredStaleCount,
    ignoredDuplicateCount,
    rejectedInvalidCount,
  };
}
