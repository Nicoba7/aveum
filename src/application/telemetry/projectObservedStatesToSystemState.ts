import type { DeviceState, SystemState } from "../../domain";
import type { CanonicalDeviceObservedState } from "../../domain/observedDeviceState";

export interface ProjectObservedStatesToSystemStateInput {
  siteId: string;
  capturedAt: string;
  timezone: string;
  devices: DeviceState[];
  observedStates: CanonicalDeviceObservedState[];
}

function average(values: number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Pure aggregate projection from observed device states into canonical system state.
 */
export function projectObservedStatesToSystemState(
  input: ProjectObservedStatesToSystemStateInput,
): SystemState {
  const batterySocValues = input.observedStates
    .map((state) => state.batterySocPercent)
    .filter((value): value is number => value !== undefined);

  const solarGenerationW = input.observedStates.reduce(
    (sum, state) => sum + (state.solarGenerationW ?? 0),
    0,
  );
  const batteryPowerW = input.observedStates.reduce(
    (sum, state) => sum + (state.batteryPowerW ?? 0),
    0,
  );
  const evChargingPowerW = input.observedStates.reduce(
    (sum, state) => sum + (state.evChargingPowerW ?? 0),
    0,
  );
  const gridImportPowerW = input.observedStates.reduce(
    (sum, state) => sum + (state.gridImportPowerW ?? 0),
    0,
  );
  const gridExportPowerW = input.observedStates.reduce(
    (sum, state) => sum + (state.gridExportPowerW ?? 0),
    0,
  );
  const gridPowerW = gridImportPowerW - gridExportPowerW;
  const homeLoadW = Math.max(0, gridImportPowerW + solarGenerationW + batteryPowerW - gridExportPowerW);

  return {
    siteId: input.siteId,
    capturedAt: input.capturedAt,
    timezone: input.timezone,
    devices: input.devices,
    homeLoadW,
    solarGenerationW,
    batteryPowerW,
    evChargingPowerW,
    gridPowerW,
    batterySocPercent: average(batterySocValues),
    evConnected: input.observedStates.some((state) => state.evConnected === true),
  };
}
