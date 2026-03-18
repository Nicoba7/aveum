import type { CanonicalDeviceTelemetry } from "../domain/telemetry";

/**
 * Adapter seam for translating vendor telemetry payloads into canonical telemetry events.
 */
export interface TelemetryTranslationAdapter<TVendorTelemetry = unknown> {
  mapVendorTelemetryToCanonicalTelemetry(payload: TVendorTelemetry): CanonicalDeviceTelemetry[];
}
