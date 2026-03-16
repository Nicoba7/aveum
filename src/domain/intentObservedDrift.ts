export type IntentObservedDriftOutcome =
  | "in_sync"
  | "drift_detected"
  | "insufficient_observed_data"
  | "not_comparable";

export type IntentObservedDriftReasonCode =
  | "NO_SHADOW_INTENT"
  | "NO_OBSERVED_STATE"
  | "INTENT_KIND_NOT_SUPPORTED"
  | "MODE_COMPARISON_NOT_SUPPORTED"
  | "OBSERVED_CHARGING_STATE_MISSING"
  | "CHARGING_STATE_MISMATCH"
  | "OBSERVED_POWER_MISSING"
  | "POWER_LIMIT_EXCEEDED"
  | "INTENT_OBSERVED_SYNC";

export interface IntentObservedDriftResult {
  deviceId: string;
  comparedAt: string;
  outcome: IntentObservedDriftOutcome;
  reasonCodes: IntentObservedDriftReasonCode[];
  shadowUpdatedAt?: string;
  observedTelemetryAt?: string;
  expectedChargingState?: "charging" | "discharging" | "idle";
  observedChargingState?: string;
  intendedPowerLimitW?: number;
  observedBatteryPowerW?: number;
}
