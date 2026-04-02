import { beforeEach, describe, expect, it, vi } from "vitest";
import { EcoFlowAdapter } from "../adapters/ecoflow/EcoFlowAdapter";
import {
  EcoFlowHttpApiClient,
  EcoFlowTransportError,
  type EcoFlowApiClient,
  type EcoFlowDeviceQuota,
} from "../adapters/ecoflow/EcoFlowApiClient";
import { runRealDeviceAdapterContractHarness } from "./harness/realDeviceAdapterContractHarness";

const DEVICE_ID = "ecoflow-device-1";
const OTHER_DEVICE_ID = "other-device-1";
const DEVICE_SN = "RIVER-123456";
const ACCESS_KEY = "access-key-1";
const SECRET_KEY = "secret-key-1";

const quotaPayload: EcoFlowDeviceQuota = {
  deviceSn: DEVICE_SN,
  batterySocPercent: 64,
  acChargingEnabled: true,
  gridPowerW: 1200,
  raw: { data: {} },
};

const scheduleCommand = {
  kind: "schedule_window" as const,
  targetDeviceId: DEVICE_ID,
  effectiveWindow: {
    startAt: "2026-04-02T00:30:00.000Z",
    endAt: "2026-04-02T03:30:00.000Z",
  },
};

function makeClient(overrides: Partial<EcoFlowApiClient> = {}): EcoFlowApiClient {
  return {
    getDeviceQuota: vi.fn(async () => quotaPayload),
    setChargingSwitch: vi.fn(async () => ({ success: true })),
    ...overrides,
  };
}

runRealDeviceAdapterContractHarness({
  suiteName: "EcoFlowAdapter contract harness",
  createAdapter: () =>
    new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    }),
  supportedDeviceId: DEVICE_ID,
  unsupportedDeviceId: OTHER_DEVICE_ID,
  canonicalCommand: scheduleCommand,
  vendorTelemetryPayload: quotaPayload,
  vendorErrorSample: new EcoFlowTransportError("AUTH_FAILURE", "Unauthorized", 401, false),
});

describe("EcoFlowAdapter", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("declares expected capabilities", () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    expect(adapter.capabilities).toEqual(["read_soc", "read_power", "schedule_window"]);
  });

  it("reads telemetry from quota endpoint via client", async () => {
    const client = makeClient();
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client,
    });

    await adapter.readTelemetry();
    expect(client.getDeviceQuota).toHaveBeenCalledWith(DEVICE_SN);
  });

  it("maps battery soc and import power telemetry", async () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    const telemetry = await adapter.readTelemetry();
    expect(telemetry[0].batterySocPercent).toBe(64);
    expect(telemetry[0].chargingState).toBe("charging");
    expect(telemetry[0].gridImportPowerW).toBe(1200);
    expect(telemetry[0].gridExportPowerW).toBeUndefined();
  });

  it("maps negative grid power to export", () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    const [event] = adapter.mapVendorTelemetryToCanonicalTelemetry({
      ...quotaPayload,
      acChargingEnabled: false,
      gridPowerW: -830,
    });

    expect(event.chargingState).toBe("idle");
    expect(event.gridImportPowerW).toBeUndefined();
    expect(event.gridExportPowerW).toBe(830);
  });

  it("dispatches non schedule commands as accepted no-op", async () => {
    const client = makeClient();
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client,
    });

    const result = await adapter.dispatchVendorCommand({
      kind: "refresh_state",
      targetDeviceId: DEVICE_ID,
    });

    expect(result.success).toBe(true);
    expect(client.setChargingSwitch).not.toHaveBeenCalled();
  });

  it("schedules charging switch on at start and off at end", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));

    const client = makeClient();
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client,
    });

    await adapter.dispatchVendorCommand(scheduleCommand);

    expect(client.setChargingSwitch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1);
    expect(client.setChargingSwitch).toHaveBeenCalledWith(DEVICE_SN, true);
    await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000 + 1);
    expect(client.setChargingSwitch).toHaveBeenCalledWith(DEVICE_SN, false);
    expect(client.setChargingSwitch).toHaveBeenCalledTimes(2);
  });

  it("executes scheduled switches immediately when window is in the past", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T04:00:00.000Z"));

    const client = makeClient();
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client,
    });

    await adapter.dispatchVendorCommand(scheduleCommand);
    expect(client.setChargingSwitch).toHaveBeenCalledWith(DEVICE_SN, true);
    expect(client.setChargingSwitch).toHaveBeenCalledWith(DEVICE_SN, false);
  });

  it("throws unsupported device for foreign target", async () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    await expect(
      adapter.dispatchVendorCommand({ ...scheduleCommand, targetDeviceId: OTHER_DEVICE_ID }),
    ).rejects.toThrow(/does not handle device/);
  });

  it("throws auth failure when credentials are missing", async () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: "",
      secretKey: "",
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    await expect(adapter.readTelemetry()).rejects.toThrow(/credentials are missing/);
  });

  it("maps AUTH_FAILURE to UNAUTHORIZED", () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new EcoFlowTransportError("AUTH_FAILURE", "bad auth", 401, false),
      "command_dispatch",
    );

    expect(mapped.code).toBe("UNAUTHORIZED");
    expect(mapped.retryable).toBe(false);
  });

  it("maps RATE_LIMIT to RATE_LIMITED", () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new EcoFlowTransportError("RATE_LIMIT", "too many", 429, true),
      "telemetry_translation",
    );

    expect(mapped.code).toBe("RATE_LIMITED");
    expect(mapped.retryable).toBe(true);
  });

  it("maps MALFORMED_RESPONSE to INVALID_VENDOR_RESPONSE", () => {
    const adapter = new EcoFlowAdapter({
      deviceId: DEVICE_ID,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      deviceSn: DEVICE_SN,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new EcoFlowTransportError("MALFORMED_RESPONSE", "bad payload", undefined, false),
      "telemetry_translation",
    );

    expect(mapped.code).toBe("INVALID_VENDOR_RESPONSE");
    expect(mapped.retryable).toBe(false);
  });
});

describe("EcoFlowHttpApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to quota endpoint with signed headers", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { batterySocPercent: 55, acChargingEnabled: 1, gridPowerW: 900 } }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      fetchFn,
    });

    const quota = await client.getDeviceQuota(DEVICE_SN);

    const [calledUrl, calledInit] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(calledUrl).toBe("https://api.ecoflow.com/iot-open/sign/device/quota");
    expect(calledInit.method).toBe("POST");
    expect(JSON.parse(calledInit.body as string)).toEqual({ sn: DEVICE_SN });
    const headers = calledInit.headers as Record<string, string>;
    expect(headers.accessKey).toBe(ACCESS_KEY);
    expect(headers.sign).toBeTruthy();
    expect(quota.batterySocPercent).toBe(55);
  });

  it("posts charging switch command to quota/set endpoint", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 0 }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      fetchFn,
    });

    const result = await client.setChargingSwitch(DEVICE_SN, true);

    const [calledUrl, calledInit] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(calledUrl).toBe("https://api.ecoflow.com/iot-open/sign/device/quota/set");
    expect(calledInit.method).toBe("POST");
    expect(JSON.parse(calledInit.body as string)).toEqual({
      sn: DEVICE_SN,
      cmdCode: "ac_chg_switch",
      cmdValue: 1,
    });
    expect(result.success).toBe(true);
  });

  it("maps AUTH_FAILURE for 401", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 401 }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    await expect(client.getDeviceQuota(DEVICE_SN)).rejects.toThrow(/status 401/);
  });

  it("maps RATE_LIMIT for 429", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ code: 429 }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    await expect(client.getDeviceQuota(DEVICE_SN)).rejects.toThrow(/status 429/);
  });

  it("maps timeout for 408", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 408,
      json: async () => ({ code: 408 }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    await expect(client.getDeviceQuota(DEVICE_SN)).rejects.toThrow(/status 408/);
  });

  it("throws malformed response when SoC is missing", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { acChargingEnabled: 1, gridPowerW: 900 } }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    await expect(client.getDeviceQuota(DEVICE_SN)).rejects.toThrow(/missing battery SoC/);
  });

  it("throws malformed response for non-JSON payload", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new Error("bad json"); },
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    await expect(client.getDeviceQuota(DEVICE_SN)).rejects.toThrow(/non-JSON/);
  });

  it("throws network error when fetch fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    await expect(client.getDeviceQuota(DEVICE_SN)).rejects.toThrow(/network request failed/);
  });

  it("parses alternate quota keys", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { soc: "48", acChgSwitch: "true", gridPower: "-350" } }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({ accessKey: ACCESS_KEY, secretKey: SECRET_KEY, fetchFn });
    const quota = await client.getDeviceQuota(DEVICE_SN);

    expect(quota.batterySocPercent).toBe(48);
    expect(quota.acChargingEnabled).toBe(true);
    expect(quota.gridPowerW).toBe(-350);
  });

  it("uses custom baseUrl when provided", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { batterySocPercent: 67, acChargingEnabled: false, gridPowerW: 0 } }),
    })) as unknown as typeof fetch;

    const client = new EcoFlowHttpApiClient({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      baseUrl: "https://custom.ecoflow.test",
      fetchFn,
    });

    await client.getDeviceQuota(DEVICE_SN);
    const [calledUrl] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://custom.ecoflow.test/iot-open/sign/device/quota");
  });
});
