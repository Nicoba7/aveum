type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const BASE_URL = "https://eu5.fusionsolar.huawei.com/thirdData";

export interface HuaweiStation {
  stationCode: string;
  raw: unknown;
}

export interface HuaweiStationRealKpi {
  stationCode: string;
  currentPowerW: number;
  dailyYieldKwh: number;
  deviceStatus: string;
  raw: unknown;
}

export interface HuaweiDeviceRealKpi {
  batterySocPercent: number;
  batteryPowerW: number;
  raw: unknown;
}

export interface HuaweiCommandResult {
  success: boolean;
  message?: string;
}

export type HuaweiTransportErrorCode =
  | "AUTH_FAILURE"
  | "UNSUPPORTED_DEVICE"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "TEMPORARY_UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR";

export class HuaweiTransportError extends Error {
  constructor(
    public readonly code: HuaweiTransportErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "HuaweiTransportError";
  }
}

export interface HuaweiApiClient {
  login(userName: string, systemCode: string): Promise<string>;
  getStationList(token: string): Promise<HuaweiStation[]>;
  getStationRealKpi(token: string, stationCode: string): Promise<HuaweiStationRealKpi>;
  getDeviceRealKpi(token: string, devTypeId: number, sns: string[]): Promise<HuaweiDeviceRealKpi>;
}

export interface HuaweiHttpApiClientOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
}

function normaliseStatusError(status: number, message: string): HuaweiTransportError {
  if (status === 401 || status === 403) {
    return new HuaweiTransportError("AUTH_FAILURE", message, status, false);
  }
  if (status === 404) {
    return new HuaweiTransportError("UNSUPPORTED_DEVICE", message, status, false);
  }
  if (status === 408) {
    return new HuaweiTransportError("TIMEOUT", message, status, true);
  }
  if (status === 429) {
    return new HuaweiTransportError("RATE_LIMIT", message, status, true);
  }
  if (status >= 500) {
    return new HuaweiTransportError("TEMPORARY_UNAVAILABLE", message, status, true);
  }
  return new HuaweiTransportError("NETWORK_ERROR", message, status, false);
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseLoginToken(payload: unknown): string {
  const root = payload as Record<string, unknown> | undefined;
  const data = (root?.data as Record<string, unknown> | undefined) ?? root;
  const token = String(data?.roarand ?? root?.roarand ?? "").trim();

  if (!token) {
    throw new HuaweiTransportError(
      "MALFORMED_RESPONSE",
      "FusionSolar login response missing roarand token.",
      undefined,
      false,
    );
  }

  return token;
}

function parseStationList(payload: unknown): HuaweiStation[] {
  const root = payload as Record<string, unknown> | undefined;
  const data = (root?.data as Record<string, unknown> | undefined) ?? root;
  const list =
    (data?.list as unknown[] | undefined) ??
    (data?.stationList as unknown[] | undefined) ??
    (root?.data as unknown[] | undefined) ??
    (root?.list as unknown[] | undefined);

  if (!Array.isArray(list)) {
    throw new HuaweiTransportError(
      "MALFORMED_RESPONSE",
      "FusionSolar station list response missing station array.",
      undefined,
      false,
    );
  }

  return list
    .map((item) => {
      const row = item as Record<string, unknown>;
      const stationCode = String(row.stationCode ?? row.stationcode ?? row.code ?? "").trim();
      if (!stationCode) return null;
      return { stationCode, raw: item } as HuaweiStation;
    })
    .filter((station): station is HuaweiStation => station !== null);
}

function parseStationRealKpi(payload: unknown, stationCode: string): HuaweiStationRealKpi {
  const root = payload as Record<string, unknown> | undefined;
  const data = (root?.data as Record<string, unknown> | undefined) ?? root;

  const currentPowerW =
    toFiniteNumber(data?.currentPower) ??
    toFiniteNumber(data?.realTimePower) ??
    toFiniteNumber(data?.inverterPower) ??
    toFiniteNumber(data?.pvPower);

  const dailyYieldKwh =
    toFiniteNumber(data?.dailyEnergy) ??
    toFiniteNumber(data?.dayPower) ??
    toFiniteNumber(data?.dailyYield) ??
    0;

  const deviceStatus = String(data?.status ?? data?.deviceStatus ?? data?.stationStatus ?? "unknown");

  if (currentPowerW === null) {
    throw new HuaweiTransportError(
      "MALFORMED_RESPONSE",
      "FusionSolar station KPI response missing current power.",
      undefined,
      false,
    );
  }

  return {
    stationCode,
    currentPowerW,
    dailyYieldKwh,
    deviceStatus,
    raw: payload,
  };
}

function parseDeviceRealKpi(payload: unknown): HuaweiDeviceRealKpi {
  const root = payload as Record<string, unknown> | undefined;
  const data = (root?.data as Record<string, unknown> | undefined) ?? root;

  const batterySocPercent =
    toFiniteNumber(data?.batterySocPercent) ??
    toFiniteNumber(data?.soc) ??
    toFiniteNumber(data?.batterySOC) ??
    toFiniteNumber(data?.chargeSoc);

  const batteryPowerW =
    toFiniteNumber(data?.batteryPowerW) ??
    toFiniteNumber(data?.chargeDischargePower) ??
    toFiniteNumber(data?.storagePower) ??
    0;

  if (batterySocPercent === null) {
    throw new HuaweiTransportError(
      "MALFORMED_RESPONSE",
      "FusionSolar device KPI response missing battery SoC.",
      undefined,
      false,
    );
  }

  return {
    batterySocPercent: Math.max(0, Math.min(100, batterySocPercent)),
    batteryPowerW,
    raw: payload,
  };
}

export class HuaweiHttpApiClient implements HuaweiApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;

  constructor(options: HuaweiHttpApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async login(userName: string, systemCode: string): Promise<string> {
    const payload = await this.callApi("/login", {
      method: "POST",
      body: {
        userName,
        systemCode,
      },
    });

    return parseLoginToken(payload);
  }

  async getStationList(token: string): Promise<HuaweiStation[]> {
    const payload = await this.callApi("/getStationList", {
      method: "POST",
      token,
      body: {},
    });

    return parseStationList(payload);
  }

  async getStationRealKpi(token: string, stationCode: string): Promise<HuaweiStationRealKpi> {
    const payload = await this.callApi("/getStationRealKpi", {
      method: "POST",
      token,
      body: { stationCodes: stationCode },
    });

    return parseStationRealKpi(payload, stationCode);
  }

  async getDeviceRealKpi(token: string, devTypeId: number, sns: string[]): Promise<HuaweiDeviceRealKpi> {
    const payload = await this.callApi("/getDeviceRealKpi", {
      method: "POST",
      token,
      body: {
        devTypeId,
        sns,
      },
    });

    return parseDeviceRealKpi(payload);
  }

  private async callApi(
    path: string,
    options: { method: "GET" | "POST"; token?: string; body?: Record<string, unknown> },
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: options.method,
        body: options.body ? JSON.stringify(options.body) : undefined,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.token ? { roarand: options.token } : {}),
        },
      });
    } catch {
      throw new HuaweiTransportError(
        "NETWORK_ERROR",
        "FusionSolar API network request failed.",
        undefined,
        true,
      );
    }

    if (!response.ok) {
      throw normaliseStatusError(
        response.status,
        `FusionSolar API request to ${path} failed with status ${response.status}.`,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new HuaweiTransportError(
        "MALFORMED_RESPONSE",
        "FusionSolar API returned non-JSON response.",
        response.status,
        false,
      );
    }
  }
}
