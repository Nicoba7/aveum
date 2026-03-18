export type ObservedStateFreshnessStatus = "fresh" | "stale" | "missing" | "unknown";

export interface DeviceObservedStateFreshness {
  deviceId: string;
  status: ObservedStateFreshnessStatus;
  lastTelemetryAt?: string;
  ageSeconds?: number;
}

export interface ObservedStateFreshnessSummary {
  capturedAt: string;
  maxAgeSeconds: number;
  overallStatus: ObservedStateFreshnessStatus;
  counts: {
    fresh: number;
    stale: number;
    missing: number;
    unknown: number;
  };
  devices: DeviceObservedStateFreshness[];
}
