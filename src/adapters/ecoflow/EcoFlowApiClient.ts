import * as crypto from "node:crypto";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const BASE_URL = "https://api.ecoflow.com";
const QUOTA_PATH = "/iot-open/sign/device/quota";
const SET_QUOTA_PATH = "/iot-open/sign/device/quota/set";

export interface EcoFlowDeviceQuota {
  deviceSn: string;
  batterySocPercent: number;
  acChargingEnabled: boolean;
  gridPowerW: number;
  raw: unknown;
}

export interface EcoFlowCommandResult {
  success: boolean;
  message?: string;
}

export type EcoFlowTransportErrorCode =
  | "AUTH_FAILURE"
  | "UNSUPPORTED_DEVICE"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "TEMPORARY_UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR";

export class EcoFlowTransportError extends Error {
  constructor(
    public readonly code: EcoFlowTransportErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "EcoFlowTransportError";
  }
}

export interface EcoFlowApiClient {
  getDeviceQuota(deviceSn: string): Promise<EcoFlowDeviceQuota>;
  setChargingSwitch(deviceSn: string, enabled: boolean): Promise<EcoFlowCommandResult>;
}

export interface EcoFlowHttpApiClientOptions {
  accessKey: string;
  secretKey: string;
  baseUrl?: string;
  fetchFn?: FetchLike;
}

function normaliseStatusError(status: number, message: string): EcoFlowTransportError {
  if (status === 401 || status === 403) {
    return new EcoFlowTransportError("AUTH_FAILURE", message, status, false);
  }
  if (status === 404) {
    return new EcoFlowTransportError("UNSUPPORTED_DEVICE", message, status, false);
  }
  if (status === 408) {
    return new EcoFlowTransportError("TIMEOUT", message, status, true);
  }
  if (status === 429) {
    return new EcoFlowTransportError("RATE_LIMIT", message, status, true);
  }
  if (status >= 500) {
    return new EcoFlowTransportError("TEMPORARY_UNAVAILABLE", message, status, true);
  }
  return new EcoFlowTransportError("NETWORK_ERROR", message, status, false);
}

function hmacSha256Hex(secret: string, content: string): string {
  return crypto.createHmac("sha256", secret).update(content).digest("hex");
}

function randomNonce(): string {
  return crypto.randomBytes(8).toString("hex");
}

function toBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "enabled";
  }
  return false;
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function assertQuotaShape(payload: unknown, deviceSn: string): EcoFlowDeviceQuota {
  const root = payload as Record<string, unknown> | undefined;
  const data = (root?.data as Record<string, unknown> | undefined) ?? root;

  const batterySocPercent =
    toFiniteNumber(data?.batterySocPercent) ??
    toFiniteNumber(data?.soc) ??
    toFiniteNumber(data?.batterySoc) ??
    toFiniteNumber(data?.bmsSoc);

  if (batterySocPercent === null) {
    throw new EcoFlowTransportError(
      "MALFORMED_RESPONSE",
      "EcoFlow quota response missing battery SoC.",
      undefined,
      false,
    );
  }

  const gridPowerW =
    toFiniteNumber(data?.gridPowerW) ??
    toFiniteNumber(data?.gridPower) ??
    toFiniteNumber(data?.gridW) ??
    0;

  const acChargingEnabled =
    toBooleanFlag(data?.acChargingEnabled) ||
    toBooleanFlag(data?.acChargingState) ||
    toBooleanFlag(data?.acChargingSwitch) ||
    toBooleanFlag(data?.acChgSwitch);

  return {
    deviceSn,
    batterySocPercent,
    acChargingEnabled,
    gridPowerW,
    raw: payload,
  };
}

export class EcoFlowHttpApiClient implements EcoFlowApiClient {
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;

  constructor(options: EcoFlowHttpApiClientOptions) {
    this.accessKey = options.accessKey;
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async getDeviceQuota(deviceSn: string): Promise<EcoFlowDeviceQuota> {
    const payload = await this.callApi(QUOTA_PATH, {
      method: "POST",
      body: {
        sn: deviceSn,
      },
    });

    return assertQuotaShape(payload, deviceSn);
  }

  async setChargingSwitch(deviceSn: string, enabled: boolean): Promise<EcoFlowCommandResult> {
    await this.callApi(SET_QUOTA_PATH, {
      method: "POST",
      body: {
        sn: deviceSn,
        cmdCode: "ac_chg_switch",
        cmdValue: enabled ? 1 : 0,
      },
    });

    return {
      success: true,
      message: `AC charging ${enabled ? "enabled" : "disabled"}.`,
    };
  }

  private async callApi(path: string, options: { method: "GET" | "POST"; body?: Record<string, unknown> }): Promise<unknown> {
    const body = options.body ? JSON.stringify(options.body) : "";
    const timestamp = Date.now().toString();
    const nonce = randomNonce();
    const signatureBase = [options.method, path, timestamp, nonce, body].join("\n");
    const signature = hmacSha256Hex(this.secretKey, signatureBase);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: options.method,
        body: body || undefined,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          accessKey: this.accessKey,
          nonce,
          timestamp,
          sign: signature,
        },
      });
    } catch {
      throw new EcoFlowTransportError(
        "NETWORK_ERROR",
        "EcoFlow API network request failed.",
        undefined,
        true,
      );
    }

    if (!response.ok) {
      throw normaliseStatusError(
        response.status,
        `EcoFlow API request to ${path} failed with status ${response.status}.`,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new EcoFlowTransportError(
        "MALFORMED_RESPONSE",
        "EcoFlow API returned non-JSON response.",
        response.status,
        false,
      );
    }
  }
}
