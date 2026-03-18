/**
 * Normalized charging state inferred from canonical telemetry.
 */
export type CanonicalChargingState = "charging" | "discharging" | "idle" | "unknown";

/**
 * Canonical latest observed state derived from telemetry ingestion.
 *
 * This represents observed real-world behavior, separate from execution intent.
 */
export interface CanonicalDeviceObservedState {
  deviceId: string;
  lastTelemetryAt: string;
  batterySocPercent?: number;
  batteryPowerW?: number;
  evChargingPowerW?: number;
  chargingState?: CanonicalChargingState;
  evConnected?: boolean;
  solarGenerationW?: number;
  gridImportPowerW?: number;
  gridExportPowerW?: number;
  stateSource: "telemetry_projection";
  schemaVersion: string;
}
