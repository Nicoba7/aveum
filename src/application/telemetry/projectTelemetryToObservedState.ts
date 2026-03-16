import type { CanonicalDeviceObservedState, CanonicalChargingState } from "../../domain/observedDeviceState";
import type { CanonicalDeviceTelemetry } from "../../domain/telemetry";

function inferChargingState(
  existing: CanonicalDeviceObservedState | undefined,
  telemetry: CanonicalDeviceTelemetry,
): CanonicalChargingState {
  if (telemetry.chargingState) {
    return telemetry.chargingState;
  }

  if (telemetry.evChargingPowerW !== undefined) {
    return telemetry.evChargingPowerW > 0 ? "charging" : "idle";
  }

  if (telemetry.batteryPowerW !== undefined) {
    if (telemetry.batteryPowerW < 0) {
      return "charging";
    }

    if (telemetry.batteryPowerW > 0) {
      return "discharging";
    }

    return "idle";
  }

  return existing?.chargingState ?? "unknown";
}

/**
 * Pure deterministic projector from canonical telemetry into observed state.
 */
export function projectTelemetryToObservedState(
  existing: CanonicalDeviceObservedState | undefined,
  telemetry: CanonicalDeviceTelemetry,
): CanonicalDeviceObservedState {
  return {
    deviceId: telemetry.deviceId,
    lastTelemetryAt: telemetry.timestamp,
    batterySocPercent: telemetry.batterySocPercent ?? existing?.batterySocPercent,
    batteryPowerW: telemetry.batteryPowerW ?? existing?.batteryPowerW,
    evChargingPowerW: telemetry.evChargingPowerW ?? existing?.evChargingPowerW,
    chargingState: inferChargingState(existing, telemetry),
    evConnected: telemetry.evConnected ?? existing?.evConnected,
    solarGenerationW: telemetry.solarGenerationW ?? existing?.solarGenerationW,
    gridImportPowerW: telemetry.gridImportPowerW ?? existing?.gridImportPowerW,
    gridExportPowerW: telemetry.gridExportPowerW ?? existing?.gridExportPowerW,
    stateSource: "telemetry_projection",
    schemaVersion: "device-observed-state.v1",
  };
}
