import type {
  IntentObservedDriftReasonCode,
  IntentObservedDriftResult,
} from "../../domain/intentObservedDrift";
import type { CanonicalDeviceObservedState } from "../../domain/observedDeviceState";
import type { CanonicalDeviceShadowState } from "../../shadow/deviceShadow";

export interface DetectIntentObservedDriftInput {
  now: string;
  shadow: CanonicalDeviceShadowState | undefined;
  observed: CanonicalDeviceObservedState | undefined;
  powerToleranceW?: number;
}

function expectedChargingStateFromShadow(
  shadow: CanonicalDeviceShadowState,
): "charging" | "discharging" | "idle" | undefined {
  const kind = shadow.lastKnownCommand?.kind;

  if (kind === "start_charging") {
    return "charging";
  }

  if (kind === "stop_charging") {
    return "idle";
  }

  const mode = shadow.lastKnownMode;
  if (mode === "charge") {
    return "charging";
  }

  if (mode === "discharge") {
    return "discharging";
  }

  if (mode === "stop" || mode === "hold") {
    return "idle";
  }

  return undefined;
}

function buildResult(
  input: DetectIntentObservedDriftInput,
  reasonCodes: IntentObservedDriftReasonCode[],
  outcome: IntentObservedDriftResult["outcome"],
  extra?: Partial<IntentObservedDriftResult>,
): IntentObservedDriftResult {
  return {
    deviceId: input.shadow?.deviceId ?? input.observed?.deviceId ?? "unknown-device",
    comparedAt: input.now,
    outcome,
    reasonCodes,
    shadowUpdatedAt: input.shadow?.lastUpdatedAt,
    observedTelemetryAt: input.observed?.lastTelemetryAt,
    ...extra,
  };
}

/**
 * Pure intent-vs-observed drift detector.
 */
export function detectIntentObservedDrift(
  input: DetectIntentObservedDriftInput,
): IntentObservedDriftResult {
  if (!input.shadow?.lastKnownCommand) {
    return buildResult(input, ["NO_SHADOW_INTENT"], "not_comparable");
  }

  if (!input.observed) {
    return buildResult(input, ["NO_OBSERVED_STATE"], "insufficient_observed_data");
  }

  const driftReasons: IntentObservedDriftReasonCode[] = [];
  const powerToleranceW = input.powerToleranceW ?? 150;

  const expectedChargingState = expectedChargingStateFromShadow(input.shadow);
  if (expectedChargingState) {
    if (!input.observed.chargingState) {
      return buildResult(
        input,
        ["OBSERVED_CHARGING_STATE_MISSING"],
        "insufficient_observed_data",
        { expectedChargingState },
      );
    }

    if (input.observed.chargingState !== expectedChargingState) {
      driftReasons.push("CHARGING_STATE_MISMATCH");
    }
  }

  const kind = input.shadow.lastKnownCommand.kind;
  if (kind === "set_power_limit" || input.shadow.lastKnownPowerW !== undefined) {
    const intendedPowerLimitW = input.shadow.lastKnownPowerW;
    if (intendedPowerLimitW !== undefined) {
      if (input.observed.batteryPowerW === undefined) {
        return buildResult(
          input,
          ["OBSERVED_POWER_MISSING"],
          "insufficient_observed_data",
          { intendedPowerLimitW },
        );
      }

      if (Math.abs(input.observed.batteryPowerW) > intendedPowerLimitW + powerToleranceW) {
        driftReasons.push("POWER_LIMIT_EXCEEDED");
      }
    }
  }

  if (kind === "set_mode" && input.shadow.lastKnownMode && expectedChargingState === undefined) {
    return buildResult(input, ["MODE_COMPARISON_NOT_SUPPORTED"], "not_comparable");
  }

  const supportedKinds = new Set([
    "start_charging",
    "stop_charging",
    "set_mode",
    "set_power_limit",
    "schedule_window",
  ]);

  if (!supportedKinds.has(kind)) {
    return buildResult(input, ["INTENT_KIND_NOT_SUPPORTED"], "not_comparable");
  }

  if (driftReasons.length > 0) {
    return buildResult(input, driftReasons, "drift_detected", {
      expectedChargingState,
      observedChargingState: input.observed.chargingState,
      intendedPowerLimitW: input.shadow.lastKnownPowerW,
      observedBatteryPowerW: input.observed.batteryPowerW,
    });
  }

  return buildResult(input, ["INTENT_OBSERVED_SYNC"], "in_sync", {
    expectedChargingState,
    observedChargingState: input.observed.chargingState,
    intendedPowerLimitW: input.shadow.lastKnownPowerW,
    observedBatteryPowerW: input.observed.batteryPowerW,
  });
}
