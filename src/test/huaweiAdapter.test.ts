import { beforeEach, describe, expect, it, vi } from "vitest";
import { HuaweiAdapter } from "../adapters/huawei/HuaweiAdapter";
import {
  HuaweiHttpApiClient,
  HuaweiTransportError,
  type HuaweiApiClient,
  type HuaweiDeviceRealKpi,
  type HuaweiStationRealKpi,
} from "../adapters/huawei/HuaweiApiClient";
import { runRealDeviceAdapterContractHarness } from "./harness/realDeviceAdapterContractHarness";

const DEVICE_ID = "huawei-device-1";
const OTHER_DEVICE_ID = "other-device-1";
const USERNAME = "huawei-user";
const SYSTEM_CODE = "huawei-system-code";
const STATION_CODE = "station-001";
const TOKEN = "roarand-token-abc";

const stationKpiPayload: HuaweiStationRealKpi = {
  stationCode: STATION_CODE,
  currentPowerW: 4200,
  dailyYieldKwh: 18.5,
  deviceStatus: "normal",
  raw: { data: { currentPower: 4200 } },
};

const deviceKpiPayload: HuaweiDeviceRealKpi = {
  batterySocPercent: 67,
  batteryPowerW: 1400,
  raw: { data: { soc: 67, chargeDischargePower: 1400 } },
};

const scheduleCommand = {
  kind: "schedule_window" as const,
  targetDeviceId: DEVICE_ID,
  effectiveWindow: {
    startAt: "2026-04-02T00:30:00.000Z",
    endAt: "2026-04-02T03:30:00.000Z",
  },
};

function makeClient(overrides: Partial<HuaweiApiClient> = {}): HuaweiApiClient {
  return {
    login: vi.fn(async () => TOKEN),
    getStationList: vi.fn(async () => [{ stationCode: STATION_CODE, raw: {} }]),
    getStationRealKpi: vi.fn(async () => stationKpiPayload),
    getDeviceRealKpi: vi.fn(async () => deviceKpiPayload),
    ...overrides,
  };
}

runRealDeviceAdapterContractHarness({
  suiteName: "HuaweiAdapter contract harness",
  createAdapter: () =>
    new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    }),
  supportedDeviceId: DEVICE_ID,
  unsupportedDeviceId: OTHER_DEVICE_ID,
  canonicalCommand: scheduleCommand,
  vendorTelemetryPayload: {
    stationKpi: stationKpiPayload,
    deviceKpi: deviceKpiPayload,
  },
  vendorErrorSample: new HuaweiTransportError("AUTH_FAILURE", "Token expired.", 401, false),
});

describe("HuaweiAdapter", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("declares expected capabilities", () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    expect(adapter.capabilities).toEqual(["read_soc", "read_power", "schedule_window"]);
  });

  it("logs in and reads station/device KPI telemetry", async () => {
    const client = makeClient();
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client,
    });

    await adapter.readTelemetry();

    expect(client.login).toHaveBeenCalledWith(USERNAME, SYSTEM_CODE);
    expect(client.getStationRealKpi).toHaveBeenCalledWith(TOKEN, STATION_CODE);
    expect(client.getDeviceRealKpi).toHaveBeenCalledWith(TOKEN, 39, []);
  });

  it("falls back to getStationList when stationCode is not configured", async () => {
    const client = makeClient();
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      client,
    });

    await adapter.readTelemetry();

    expect(client.getStationList).toHaveBeenCalledWith(TOKEN);
    expect(client.getStationRealKpi).toHaveBeenCalledWith(TOKEN, STATION_CODE);
  });

  it("maps telemetry into canonical battery and solar fields", async () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    const telemetry = await adapter.readTelemetry();
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0].deviceId).toBe(DEVICE_ID);
    expect(telemetry[0].batterySocPercent).toBe(67);
    expect(telemetry[0].batteryPowerW).toBe(1400);
    expect(telemetry[0].solarGenerationW).toBe(4200);
    expect(telemetry[0].chargingState).toBe("charging");
  });

  it("maps negative battery power to discharging", () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    const [event] = adapter.mapVendorTelemetryToCanonicalTelemetry({
      stationKpi: stationKpiPayload,
      deviceKpi: { ...deviceKpiPayload, batteryPowerW: -900 },
    });

    expect(event.chargingState).toBe("discharging");
    expect(event.batteryPowerW).toBe(-900);
  });

  it("returns accepted no-op for non-schedule command", async () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    const result = await adapter.dispatchVendorCommand({
      kind: "refresh_state",
      targetDeviceId: DEVICE_ID,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("acknowledged");
  });

  it("schedule_window returns accepted recommendation note", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    const result = await adapter.dispatchVendorCommand(scheduleCommand);

    expect(result.success).toBe(true);
    expect(result.message).toContain("limited write capability");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("throws unsupported device for foreign target", async () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    await expect(
      adapter.dispatchVendorCommand({ ...scheduleCommand, targetDeviceId: OTHER_DEVICE_ID }),
    ).rejects.toThrow(/does not handle device/);
  });

  it("throws auth failure when credentials are missing", async () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: "",
      systemCode: "",
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    await expect(adapter.readTelemetry()).rejects.toThrow(/credentials are missing/);
  });

  it("throws when station list has no station code", async () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      client: makeClient({ getStationList: vi.fn(async () => []) }),
    });

    await expect(adapter.readTelemetry()).rejects.toThrow(/No FusionSolar stationCode available/);
  });

  it("maps AUTH_FAILURE to UNAUTHORIZED", () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new HuaweiTransportError("AUTH_FAILURE", "bad auth", 401, false),
      "command_dispatch",
    );

    expect(mapped.code).toBe("UNAUTHORIZED");
  });

  it("maps RATE_LIMIT to RATE_LIMITED", () => {
    const adapter = new HuaweiAdapter({
      deviceId: DEVICE_ID,
      userName: USERNAME,
      systemCode: SYSTEM_CODE,
      stationCode: STATION_CODE,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new HuaweiTransportError("RATE_LIMIT", "too many", 429, true),
      "telemetry_translation",
    );

    expect(mapped.code).toBe("RATE_LIMITED");
    expect(mapped.retryable).toBe(true);
  });
});

describe("HuaweiHttpApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("login posts to /login and returns roarand token", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { roarand: TOKEN } }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const token = await client.login(USERNAME, SYSTEM_CODE);

    expect(token).toBe(TOKEN);
    const calledUrl = String((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    const calledInit = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(calledUrl).toContain("/login");
    expect(calledInit.method).toBe("POST");
    expect(calledInit.body).toBe(JSON.stringify({ userName: USERNAME, systemCode: SYSTEM_CODE }));
  });

  it("getStationList uses roarand header", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { list: [{ stationCode: STATION_CODE }] } }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const stations = await client.getStationList(TOKEN);

    expect(stations[0].stationCode).toBe(STATION_CODE);
    const calledInit = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((calledInit.headers as Record<string, string>).roarand).toBe(TOKEN);
  });

  it("getStationRealKpi returns current power/daily yield/status", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { currentPower: 5100, dayPower: 21.3, status: "normal" } }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const kpi = await client.getStationRealKpi(TOKEN, STATION_CODE);

    expect(kpi.currentPowerW).toBe(5100);
    expect(kpi.dailyYieldKwh).toBe(21.3);
    expect(kpi.deviceStatus).toBe("normal");
  });

  it("getDeviceRealKpi returns battery soc and charge/discharge power", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { soc: 72, chargeDischargePower: -800 } }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const kpi = await client.getDeviceRealKpi(TOKEN, 39, []);

    expect(kpi.batterySocPercent).toBe(72);
    expect(kpi.batteryPowerW).toBe(-800);
  });

  it("throws AUTH_FAILURE for 401", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });
    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });

    const err = await client.login(USERNAME, SYSTEM_CODE).catch((e) => e);
    expect(err).toBeInstanceOf(HuaweiTransportError);
    expect(err.code).toBe("AUTH_FAILURE");
  });

  it("throws RATE_LIMIT for 429", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 });
    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });

    const err = await client.getStationList(TOKEN).catch((e) => e);
    expect(err.code).toBe("RATE_LIMIT");
  });

  it("throws TIMEOUT for 408", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 408 });
    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });

    const err = await client.getStationRealKpi(TOKEN, STATION_CODE).catch((e) => e);
    expect(err.code).toBe("TIMEOUT");
  });

  it("throws TEMPORARY_UNAVAILABLE for 500", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });

    const err = await client.getDeviceRealKpi(TOKEN, 39, []).catch((e) => e);
    expect(err.code).toBe("TEMPORARY_UNAVAILABLE");
  });

  it("throws MALFORMED_RESPONSE when login token is missing", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.login(USERNAME, SYSTEM_CODE)).rejects.toThrow(/missing roarand token/);
  });

  it("throws MALFORMED_RESPONSE when station list is missing", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.getStationList(TOKEN)).rejects.toThrow(/missing station array/);
  });

  it("throws MALFORMED_RESPONSE when station kpi has no current power", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { status: "normal" } }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.getStationRealKpi(TOKEN, STATION_CODE)).rejects.toThrow(/missing current power/);
  });

  it("throws MALFORMED_RESPONSE when device kpi has no soc", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { chargeDischargePower: 900 } }),
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.getDeviceRealKpi(TOKEN, 39, [])).rejects.toThrow(/missing battery SoC/);
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error("network down"));
    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });

    const err = await client.login(USERNAME, SYSTEM_CODE).catch((e) => e);
    expect(err.code).toBe("NETWORK_ERROR");
  });

  it("throws MALFORMED_RESPONSE on non-json response", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    const client = new HuaweiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const err = await client.login(USERNAME, SYSTEM_CODE).catch((e) => e);
    expect(err.code).toBe("MALFORMED_RESPONSE");
  });

  it("supports custom baseUrl", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { roarand: TOKEN } }),
    });

    const client = new HuaweiHttpApiClient({
      baseUrl: "https://custom.fusionsolar.test/thirdData",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await client.login(USERNAME, SYSTEM_CODE);
    const calledUrl = String((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl.startsWith("https://custom.fusionsolar.test/thirdData")).toBe(true);
  });
});
