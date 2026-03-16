import type { CanonicalChargingState } from "./observedDeviceState";

/**
 * Canonical vendor-neutral telemetry event emitted by adapter translation.
 */
export interface CanonicalDeviceTelemetry {
  deviceId: string;
  timestamp: string;
  batterySocPercent?: number;
  batteryPowerW?: number;
  evChargingPowerW?: number;
  chargingState?: CanonicalChargingState;
  evConnected?: boolean;
  solarGenerationW?: number;
  gridImportPowerW?: number;
  gridExportPowerW?: number;
  schemaVersion: string;
}
