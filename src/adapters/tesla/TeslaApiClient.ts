export interface TeslaStartChargingRequest {
  vehicleId: string;
}

export interface TeslaStopChargingRequest {
  vehicleId: string;
}

export interface TeslaReadChargingTelemetryRequest {
  vehicleId: string;
}

export interface TeslaChargeCommandTransportResponse {
  result: boolean;
  reason?: string;
}

export interface TeslaChargingTelemetryTransportResponse {
  vehicleId: string;
  timestamp: string;
  chargingState?: "Charging" | "Stopped" | "Complete" | "Disconnected" | string;
  chargePortLatch?: "Engaged" | "Disengaged" | string;
  chargerPowerKw?: number;
  batteryLevel?: number;
}

export type TeslaTransportErrorCode =
  | "UNSUPPORTED_DEVICE"
  | "AUTH_FAILURE"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "TEMPORARY_UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR";

export class TeslaTransportError extends Error {
  constructor(
    public readonly code: TeslaTransportErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "TeslaTransportError";
  }
}

export interface TeslaApiClient {
  startCharging(request: TeslaStartChargingRequest): Promise<TeslaChargeCommandTransportResponse>;
  stopCharging(request: TeslaStopChargingRequest): Promise<TeslaChargeCommandTransportResponse>;
  readChargingTelemetry(request: TeslaReadChargingTelemetryRequest): Promise<TeslaChargingTelemetryTransportResponse>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TeslaHttpApiClientOptions {
  baseUrl?: string;
  accessToken: string;
  timeoutMs?: number;
  fetchFn?: FetchLike;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError";
}

function normalizeStatusError(status: number, message: string): TeslaTransportError {
  if (status === 401 || status === 403) {
    return new TeslaTransportError("AUTH_FAILURE", message, status, false);
  }

  if (status === 429) {
    return new TeslaTransportError("RATE_LIMIT", message, status, true);
  }

  if (status >= 500) {
    return new TeslaTransportError("TEMPORARY_UNAVAILABLE", message, status, true);
  }

  return new TeslaTransportError("NETWORK_ERROR", message, status, false);
}

function assertChargeCommandShape(payload: unknown): TeslaChargeCommandTransportResponse {
  const response = (payload as { response?: { result?: unknown; reason?: unknown } })?.response;
  if (!response || typeof response.result !== "boolean") {
    throw new TeslaTransportError("MALFORMED_RESPONSE", "Malformed Tesla charge command response.", undefined, false);
  }

  return {
    result: response.result,
    reason: typeof response.reason === "string" ? response.reason : undefined,
  };
}

function assertChargingTelemetryShape(
  vehicleId: string,
  payload: unknown,
): TeslaChargingTelemetryTransportResponse {
  const response = (payload as { response?: { charge_state?: Record<string, unknown> } })?.response;
  const chargeState = response?.charge_state;
  if (!chargeState || typeof chargeState !== "object") {
    throw new TeslaTransportError("MALFORMED_RESPONSE", "Malformed Tesla charging telemetry response.", undefined, false);
  }

  const timestampRaw = chargeState.timestamp;
  if (typeof timestampRaw !== "number" || !Number.isFinite(timestampRaw)) {
    throw new TeslaTransportError("MALFORMED_RESPONSE", "Tesla charging telemetry missing timestamp.", undefined, false);
  }

  return {
    vehicleId,
    timestamp: new Date(timestampRaw).toISOString(),
    chargingState: typeof chargeState.charging_state === "string" ? chargeState.charging_state : undefined,
    chargePortLatch: typeof chargeState.charge_port_latch === "string" ? chargeState.charge_port_latch : undefined,
    chargerPowerKw: typeof chargeState.charger_power === "number" ? chargeState.charger_power : undefined,
    batteryLevel: typeof chargeState.battery_level === "number" ? chargeState.battery_level : undefined,
  };
}

/**
 * Thin production-shaped Tesla Fleet transport client.
 */
export class TeslaHttpApiClient implements TeslaApiClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;

  constructor(options: TeslaHttpApiClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://fleet-api.prd.eu.vn.cloud.tesla.com";
    this.accessToken = options.accessToken;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async startCharging(request: TeslaStartChargingRequest): Promise<TeslaChargeCommandTransportResponse> {
    const payload = await this.callTeslaApi(
      `/api/1/vehicles/${request.vehicleId}/command/charge_start`,
      { method: "POST" },
    );

    return assertChargeCommandShape(payload);
  }

  async stopCharging(request: TeslaStopChargingRequest): Promise<TeslaChargeCommandTransportResponse> {
    const payload = await this.callTeslaApi(
      `/api/1/vehicles/${request.vehicleId}/command/charge_stop`,
      { method: "POST" },
    );

    return assertChargeCommandShape(payload);
  }

  async readChargingTelemetry(request: TeslaReadChargingTelemetryRequest): Promise<TeslaChargingTelemetryTransportResponse> {
    const payload = await this.callTeslaApi(
      `/api/1/vehicles/${request.vehicleId}/vehicle_data?endpoints=charge_state`,
      { method: "GET" },
    );

    return assertChargingTelemetryShape(request.vehicleId, payload);
  }

  private async callTeslaApi(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const message = `Tesla API request failed with status ${response.status}.`;
        throw normalizeStatusError(response.status, message);
      }

      try {
        return await response.json();
      } catch {
        throw new TeslaTransportError("MALFORMED_RESPONSE", "Tesla API returned non-JSON response.", response.status, false);
      }
    } catch (error) {
      if (error instanceof TeslaTransportError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new TeslaTransportError("TIMEOUT", "Tesla API request timed out.", undefined, true);
      }

      throw new TeslaTransportError("NETWORK_ERROR", "Tesla API network request failed.", undefined, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
