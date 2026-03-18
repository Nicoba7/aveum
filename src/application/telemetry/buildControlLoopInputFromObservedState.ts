import type { DeviceState } from "../../domain";
import type { OptimizerOutput } from "../../domain/optimizer";
import type { ControlLoopInput } from "../../controlLoop/controlLoop";
import type { ObservedDeviceStateStore } from "../../observed/observedDeviceStateStore";
import type { TelemetryIngestionOutcome } from "./ingestionService";
import { deriveTelemetryHealth } from "./deriveTelemetryHealth";
import { evaluateObservedStateFreshness } from "./evaluateObservedStateFreshness";
import { projectObservedStatesToSystemState } from "./projectObservedStatesToSystemState";

export interface BuildControlLoopInputFromObservedStateParams {
  now: string;
  siteId: string;
  timezone: string;
  devices: DeviceState[];
  optimizerOutput: OptimizerOutput;
  observedStateStore: ObservedDeviceStateStore;
  deviceTelemetry?: ControlLoopInput["deviceTelemetry"];
  freshnessMaxAgeSeconds?: number;
  recentTelemetryIngestionOutcomes?: TelemetryIngestionOutcome[];
}

/**
 * Thin application seam that composes telemetry-observed state into ControlLoopInput.
 */
export function buildControlLoopInputFromObservedState(
  params: BuildControlLoopInputFromObservedStateParams,
): ControlLoopInput {
  const observedStatesByDeviceId = params.observedStateStore.getAllDeviceStates();
  const observedStates = Object.values(observedStatesByDeviceId);
  const observedStateFreshness = evaluateObservedStateFreshness({
    now: params.now,
    knownDeviceIds: params.devices.map((device) => device.deviceId),
    observedStatesByDeviceId,
    maxAgeSeconds: params.freshnessMaxAgeSeconds,
  });
  const telemetryHealth = deriveTelemetryHealth({
    freshness: observedStateFreshness,
    recentIngestionOutcomes: params.recentTelemetryIngestionOutcomes,
  });
  const systemState = projectObservedStatesToSystemState({
    siteId: params.siteId,
    capturedAt: params.now,
    timezone: params.timezone,
    devices: params.devices,
    observedStates,
  });

  return {
    now: params.now,
    systemState,
    optimizerOutput: params.optimizerOutput,
    deviceTelemetry: params.deviceTelemetry,
    observedStateFreshness,
    telemetryHealth,
  };
}
