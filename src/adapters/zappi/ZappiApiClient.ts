import * as crypto from "node:crypto";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE_URL = "https://s18.myenergi.net";
const DIRECTOR_URL = "https://director.myenergi.com/cgi-jstatus-Z";

export type ZappiChargeMode = 1 | 2 | 3 | 4;

export interface ZappiStatusPayload {
  zappiSerial: string;
  chargeMode: ZappiChargeMode;
  powerW: number;
  connected: boolean;
  raw: unknown;
}

export interface ZappiCommandResult {
  success: boolean;
  message?: string;
}

export type ZappiTransportErrorCode =
  | "AUTH_FAILURE"
  | "UNSUPPORTED_DEVICE"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "TEMPORARY_UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR";

export class ZappiTransportError extends Error {
  constructor(
    public readonly code: ZappiTransportErrorCode,
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "ZappiTransportError";
  }
}

export interface ZappiApiClient {
  login(hubSerial: string, apiKey: string): Promise<{ directorBaseUrl: string }>;
  getStatus(hubSerial: string, zappiSerial: string): Promise<ZappiStatusPayload>;
  setChargeMode(hubSerial: string, zappiSerial: string, mode: ZappiChargeMode): Promise<ZappiCommandResult>;
}

export interface ZappiHttpApiClientOptions {
  baseUrl?: string;
  fetchFn?: FetchLike;
}

function normaliseStatusError(status: number, message: string): ZappiTransportError {
  if (status === 401 || status === 403) {
    return new ZappiTransportError("AUTH_FAILURE", message, status, false);
  }
  if (status === 404) {
    return new ZappiTransportError("UNSUPPORTED_DEVICE", message, status, false);
  }
  if (status === 429) {
    return new ZappiTransportError("RATE_LIMIT", message, status, true);
  }
  if (status >= 500) {
    return new ZappiTransportError("TEMPORARY_UNAVAILABLE", message, status, true);
  }
  return new ZappiTransportError("NETWORK_ERROR", message, status, false);
}

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
  const trimmed = header.replace(/^Digest\s+/i, "");
  const parts = trimmed.match(/(\w+)=(?:"([^"]*)"|([^,]+))/g) ?? [];
  const values: Record<string, string> = {};

  for (const part of parts) {
    const [key, value] = part.split("=");
    values[key.trim()] = value.trim().replace(/^"|"$/g, "");
  }

  return values;
}

function buildDigestAuthHeader(options: {
  challengeHeader: string;
  method: string;
  uriPathWithQuery: string;
  username: string;
  password: string;
  nc: string;
  cnonce: string;
}): string {
  const challenge = parseDigestChallenge(options.challengeHeader);
  const realm = challenge.realm;
  const nonce = challenge.nonce;

  if (!realm || !nonce) {
    throw new ZappiTransportError(
      "MALFORMED_RESPONSE",
      "Digest challenge missing realm or nonce.",
      undefined,
      false,
    );
  }

  const algorithm = (challenge.algorithm ?? "MD5").toUpperCase();
  if (algorithm !== "MD5") {
    throw new ZappiTransportError(
      "MALFORMED_RESPONSE",
      `Unsupported digest algorithm: ${algorithm}`,
      undefined,
      false,
    );
  }

  const qop = challenge.qop?.includes("auth") ? "auth" : undefined;
  const ha1 = md5(`${options.username}:${realm}:${options.password}`);
  const ha2 = md5(`${options.method}:${options.uriPathWithQuery}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${options.nc}:${options.cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const fragments = [
    `Digest username="${options.username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${options.uriPathWithQuery}"`,
    `response="${response}"`,
    `algorithm=MD5`,
  ];

  if (challenge.opaque) {
    fragments.push(`opaque="${challenge.opaque}"`);
  }

  if (qop) {
    fragments.push(`qop=${qop}`);
    fragments.push(`nc=${options.nc}`);
    fragments.push(`cnonce="${options.cnonce}"`);
  }

  return fragments.join(", ");
}

function assertZappiStatusShape(payload: unknown, zappiSerial: string): ZappiStatusPayload {
  const root = payload as Record<string, unknown> | undefined;
  const zappiEntries = root?.zappi;

  if (!Array.isArray(zappiEntries)) {
    throw new ZappiTransportError(
      "MALFORMED_RESPONSE",
      "myenergi status response missing zappi list.",
      undefined,
      false,
    );
  }

  const target = (zappiEntries as Record<string, unknown>[]).find((entry) => {
    const sno = String(entry.sno ?? "");
    return sno === zappiSerial;
  }) ?? (zappiEntries[0] as Record<string, unknown> | undefined);

  if (!target) {
    throw new ZappiTransportError(
      "UNSUPPORTED_DEVICE",
      `Zappi serial "${zappiSerial}" not found in myenergi response.`,
      404,
      false,
    );
  }

  const mode = Number(target.zmo ?? target.zm ?? target.mode ?? 4);
  const powerW = Number(target.div ?? target.ectp1 ?? target.che ?? 0);
  const connectedRaw = Number(target.car ?? target.ectt1 ?? 0);
  const connected = connectedRaw > 0 || powerW > 0;

  return {
    zappiSerial: String(target.sno ?? zappiSerial),
    chargeMode: (Number.isFinite(mode) ? Math.max(1, Math.min(4, Math.round(mode))) : 4) as ZappiChargeMode,
    powerW: Number.isFinite(powerW) ? powerW : 0,
    connected,
    raw: payload,
  };
}

export class ZappiHttpApiClient implements ZappiApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private directorBaseUrl: string | null = null;

  constructor(options: ZappiHttpApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async login(hubSerial: string, apiKey: string): Promise<{ directorBaseUrl: string }> {
    const response = await this.callDigestApi({
      absoluteUrl: DIRECTOR_URL,
      method: "GET",
      hubSerial,
      apiKey,
    });

    const directorHeader =
      response.headers.get("X-MYENERGI-ASBN") ??
      response.headers.get("x-myenergi-asbn");

    const directorBaseUrl = directorHeader?.trim();
    if (!directorBaseUrl) {
      throw new ZappiTransportError(
        "MALFORMED_RESPONSE",
        "myenergi director response missing X-MYENERGI-ASBN header.",
        response.status,
        false,
      );
    }

    this.directorBaseUrl = directorBaseUrl.startsWith("http")
      ? directorBaseUrl
      : `${this.baseUrl}`;

    return { directorBaseUrl: this.directorBaseUrl };
  }

  async getStatus(hubSerial: string, zappiSerial: string): Promise<ZappiStatusPayload> {
    const response = await this.callWithResolvedDirector({
      path: `/cgi-jstatus-Z${encodeURIComponent(zappiSerial)}`,
      method: "GET",
      hubSerial,
    });

    const payload = await this.parseJsonOrThrow(response, "myenergi status");
    return assertZappiStatusShape(payload, zappiSerial);
  }

  async setChargeMode(
    hubSerial: string,
    zappiSerial: string,
    mode: ZappiChargeMode,
  ): Promise<ZappiCommandResult> {
    await this.callWithResolvedDirector({
      path: `/cgi-zappi-mode-Z${encodeURIComponent(zappiSerial)}-${mode}`,
      method: "GET",
      hubSerial,
    });

    return { success: true, message: `Zappi mode set to ${mode}` };
  }

  private async callWithResolvedDirector(options: {
    path: string;
    method: "GET" | "POST";
    hubSerial: string;
    body?: string;
  }): Promise<Response> {
    const apiKey = process.env.ZAPPI_API_KEY?.trim();
    if (!apiKey) {
      throw new ZappiTransportError("AUTH_FAILURE", "Missing ZAPPI_API_KEY env var.", undefined, false);
    }

    if (!this.directorBaseUrl) {
      await this.login(options.hubSerial, apiKey);
    }

    const base = this.directorBaseUrl ?? this.baseUrl;
    const absoluteUrl = `${base}${options.path}`;

    return this.callDigestApi({
      absoluteUrl,
      method: options.method,
      hubSerial: options.hubSerial,
      apiKey,
      body: options.body,
    });
  }

  private async callDigestApi(options: {
    absoluteUrl: string;
    method: "GET" | "POST";
    hubSerial: string;
    apiKey: string;
    body?: string;
  }): Promise<Response> {
    const url = new URL(options.absoluteUrl);
    const uriPathWithQuery = `${url.pathname}${url.search}`;

    let challengeResponse: Response;
    try {
      challengeResponse = await this.fetchFn(url.toString(), {
        method: options.method,
        body: options.body,
      });
    } catch {
      throw new ZappiTransportError("NETWORK_ERROR", "myenergi request failed.", undefined, true);
    }

    const digestChallenge = challengeResponse.headers.get("www-authenticate");

    if (challengeResponse.status !== 401 && challengeResponse.ok) {
      return challengeResponse;
    }

    if (!digestChallenge || !/^Digest/i.test(digestChallenge)) {
      throw normaliseStatusError(
        challengeResponse.status,
        `myenergi request failed with status ${challengeResponse.status} and no digest challenge.`,
      );
    }

    const cnonce = randomHex(12);
    const nc = "00000001";
    const authorization = buildDigestAuthHeader({
      challengeHeader: digestChallenge,
      method: options.method,
      uriPathWithQuery,
      username: options.hubSerial,
      password: options.apiKey,
      nc,
      cnonce,
    });

    let response: Response;
    try {
      response = await this.fetchFn(url.toString(), {
        method: options.method,
        body: options.body,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
        },
      });
    } catch {
      throw new ZappiTransportError("NETWORK_ERROR", "myenergi request failed.", undefined, true);
    }

    if (!response.ok) {
      throw normaliseStatusError(
        response.status,
        `myenergi request to ${uriPathWithQuery} failed with status ${response.status}.`,
      );
    }

    return response;
  }

  private async parseJsonOrThrow(response: Response, operationLabel: string): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new ZappiTransportError(
        "MALFORMED_RESPONSE",
        `${operationLabel} response was not valid JSON.`,
        response.status,
        false,
      );
    }
  }
}