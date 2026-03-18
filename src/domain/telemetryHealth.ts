export type TelemetryHealthStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export type TelemetryHealthReasonCode =
  | "OBSERVED_STATE_MISSING"
  | "OBSERVED_STATE_STALE"
  | "OBSERVED_STATE_UNKNOWN"
  | "INVALID_TELEMETRY_HISTORY"
  | "INSUFFICIENT_OBSERVED_DATA"
  | "TELEMETRY_HEALTHY";

export interface DeviceTelemetryHealth {
  deviceId: string;
  status: TelemetryHealthStatus;
  reasonCodes: TelemetryHealthReasonCode[];
  lastTelemetryAt?: string;
  ageSeconds?: number;
  invalidTelemetryCount?: number;
}

export interface TelemetryHealthSummary {
  capturedAt: string;
  overallStatus: TelemetryHealthStatus;
  counts: {
    healthy: number;
    degraded: number;
    unavailable: number;
    unknown: number;
  };
  devices: DeviceTelemetryHealth[];
}
