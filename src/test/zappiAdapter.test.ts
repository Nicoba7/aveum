import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZappiAdapter } from "../adapters/zappi/ZappiAdapter";
import {
  ZappiHttpApiClient,
  ZappiTransportError,
  type ZappiApiClient,
  type ZappiStatusPayload,
} from "../adapters/zappi/ZappiApiClient";
import { runRealDeviceAdapterContractHarness } from "./harness/realDeviceAdapterContractHarness";

const DEVICE_ID = "zappi-device-1";
const OTHER_DEVICE_ID = "other-device-1";
const HUB_SERIAL = "HUB123456";
const API_KEY = "api-key-123";
const ZAPPI_SERIAL = "ZAP123456";

const statusPayload: ZappiStatusPayload = {
  zappiSerial: ZAPPI_SERIAL,
  chargeMode: 1,
  powerW: 7210,
  connected: true,
  raw: { zappi: [{ sno: ZAPPI_SERIAL }] },
};

const scheduleCommand = {
  kind: "schedule_window" as const,
  targetDeviceId: DEVICE_ID,
  effectiveWindow: {
    start: "2026-04-02T00:30:00.000Z",
    end: "2026-04-02T03:30:00.000Z",
  },
};

function makeClient(overrides: Partial<ZappiApiClient> = {}): ZappiApiClient {
  return {
    login: vi.fn(async () => ({ directorBaseUrl: "https://s18.myenergi.net" })),
    getStatus: vi.fn(async () => statusPayload),
    setChargeMode: vi.fn(async () => ({ success: true })),
    ...overrides,
  };
}

runRealDeviceAdapterContractHarness({
  suiteName: "ZappiAdapter contract harness",
  createAdapter: () =>
    new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    }),
  supportedDeviceId: DEVICE_ID,
  unsupportedDeviceId: OTHER_DEVICE_ID,
  canonicalCommand: scheduleCommand,
  vendorTelemetryPayload: statusPayload,
  vendorErrorSample: new ZappiTransportError("AUTH_FAILURE", "Token expired.", 401, false),
});

describe("ZappiAdapter", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("declares expected capabilities", () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    expect(adapter.capabilities).toEqual(["read_power", "schedule_window"]);
  });

  it("calls login before reading telemetry", async () => {
    const client = makeClient();
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client,
    });

    await adapter.readTelemetry();

    expect(client.login).toHaveBeenCalledWith(HUB_SERIAL, API_KEY);
    expect(client.getStatus).toHaveBeenCalledWith(HUB_SERIAL, ZAPPI_SERIAL);
  });

  it("maps telemetry into canonical fields", async () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    const telemetry = await adapter.readTelemetry();
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0].deviceId).toBe(DEVICE_ID);
    expect(telemetry[0].evChargingPowerW).toBe(7210);
    expect(telemetry[0].chargingState).toBe("charging");
    expect(telemetry[0].evConnected).toBe(true);
  });

  it("maps disconnected status to idle", () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    const [event] = adapter.mapVendorTelemetryToCanonicalTelemetry({
      ...statusPayload,
      powerW: 0,
      connected: false,
      chargeMode: 4,
    });

    expect(event.chargingState).toBe("idle");
  });

  it("maps unknown when connected but not charging and not stopped", () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    const [event] = adapter.mapVendorTelemetryToCanonicalTelemetry({
      ...statusPayload,
      powerW: 0,
      connected: true,
      chargeMode: 2,
    });

    expect(event.chargingState).toBe("unknown");
  });

  it("dispatches non schedule commands as accepted no-op", async () => {
    const client = makeClient();
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client,
    });

    const result = await adapter.dispatchVendorCommand({
      kind: "refresh_state",
      targetDeviceId: DEVICE_ID,
    });

    expect(result.success).toBe(true);
    expect(client.setChargeMode).not.toHaveBeenCalled();
  });

  it("schedules fast mode and stop mode for schedule_window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));

    const client = makeClient();
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client,
    });

    await adapter.dispatchVendorCommand(scheduleCommand);

    expect(client.setChargeMode).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1);
    expect(client.setChargeMode).toHaveBeenCalledWith(HUB_SERIAL, ZAPPI_SERIAL, 1);
    await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000 + 1);
    expect(client.setChargeMode).toHaveBeenCalledWith(HUB_SERIAL, ZAPPI_SERIAL, 4);
    expect(client.setChargeMode).toHaveBeenCalledTimes(2);
  });

  it("executes immediately when schedule start is in the past", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T04:00:00.000Z"));

    const client = makeClient();
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client,
    });

    await adapter.dispatchVendorCommand(scheduleCommand);
    expect(client.setChargeMode).toHaveBeenCalledWith(HUB_SERIAL, ZAPPI_SERIAL, 1);
    expect(client.setChargeMode).toHaveBeenCalledWith(HUB_SERIAL, ZAPPI_SERIAL, 4);
  });

  it("throws unsupported device for foreign target", async () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    await expect(
      adapter.dispatchVendorCommand({ ...scheduleCommand, targetDeviceId: OTHER_DEVICE_ID }),
    ).rejects.toThrow(/does not handle device/);
  });

  it("maps AUTH_FAILURE to UNAUTHORIZED", () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new ZappiTransportError("AUTH_FAILURE", "bad auth", 401, false),
      "command_dispatch",
    );

    expect(mapped.code).toBe("UNAUTHORIZED");
    expect(mapped.retryable).toBe(false);
  });

  it("maps TEMPORARY_UNAVAILABLE to UNAVAILABLE", () => {
    const adapter = new ZappiAdapter({
      deviceId: DEVICE_ID,
      hubSerial: HUB_SERIAL,
      apiKey: API_KEY,
      zappiSerial: ZAPPI_SERIAL,
      client: makeClient(),
    });

    const mapped = adapter.mapVendorErrorToCanonical(
      new ZappiTransportError("TEMPORARY_UNAVAILABLE", "down", 503, true),
      "command_dispatch",
    );

    expect(mapped.code).toBe("UNAVAILABLE");
    expect(mapped.retryable).toBe(true);
  });
});

describe("ZappiHttpApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ZAPPI_API_KEY = API_KEY;
  });

  it("login resolves director URL from X-MYENERGI-ASBN header", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-MYENERGI-ASBN": "https://s18.myenergi.net" }),
        json: async () => ({ zappi: [] }),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    const result = await client.login(HUB_SERIAL, API_KEY);

    expect(result.directorBaseUrl).toBe("https://s18.myenergi.net");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("getStatus calls cgi-jstatus endpoint for zappi serial", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-MYENERGI-ASBN": "https://s18.myenergi.net" }),
        json: async () => ({ zappi: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce2", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          zappi: [{ sno: ZAPPI_SERIAL, zmo: 1, div: 3500, car: 1 }],
        }),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });

    const status = await client.getStatus(HUB_SERIAL, ZAPPI_SERIAL);
    expect(status.zappiSerial).toBe(ZAPPI_SERIAL);
    expect(status.powerW).toBe(3500);

    const calledUrls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);
    expect(calledUrls.some((url) => String(url).includes(`/cgi-jstatus-Z${ZAPPI_SERIAL}`))).toBe(true);
  });

  it("setChargeMode calls cgi-zappi-mode endpoint", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-MYENERGI-ASBN": "https://s18.myenergi.net" }),
        json: async () => ({ zappi: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce2", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await client.setChargeMode(HUB_SERIAL, ZAPPI_SERIAL, 4);

    const calledUrls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);
    expect(calledUrls.some((url) => String(url).includes(`/cgi-zappi-mode-Z${ZAPPI_SERIAL}-4`))).toBe(true);
  });

  it("throws MALFORMED_RESPONSE when login response has no director header", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ zappi: [] }),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.login(HUB_SERIAL, API_KEY)).rejects.toThrow(/missing X-MYENERGI-ASBN/);
  });

  it("throws AUTH_FAILURE on digest-authenticated 401", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.login(HUB_SERIAL, API_KEY)).rejects.toThrow(/status 401/);
  });

  it("throws MALFORMED_RESPONSE when status payload is not shaped correctly", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-MYENERGI-ASBN": "https://s18.myenergi.net" }),
        json: async () => ({ zappi: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce2", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ bad: "shape" }),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.getStatus(HUB_SERIAL, ZAPPI_SERIAL)).rejects.toThrow(/missing zappi list/);
  });

  it("throws AUTH_FAILURE when ZAPPI_API_KEY is missing", async () => {
    delete process.env.ZAPPI_API_KEY;
    const client = new ZappiHttpApiClient({ fetchFn: vi.fn() as unknown as typeof fetch });

    await expect(client.getStatus(HUB_SERIAL, ZAPPI_SERIAL)).rejects.toThrow(/Missing ZAPPI_API_KEY/);
  });

  it("includes digest Authorization header on authenticated request", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "www-authenticate": 'Digest realm="myenergi", nonce="nonce1", qop="auth"' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-MYENERGI-ASBN": "https://s18.myenergi.net" }),
        json: async () => ({ zappi: [] }),
      });

    const client = new ZappiHttpApiClient({ fetchFn: fetchFn as unknown as typeof fetch });
    await client.login(HUB_SERIAL, API_KEY);

    const authenticatedCallInit = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1][1] as RequestInit;
    const authHeader = (authenticatedCallInit.headers as Record<string, string>).Authorization;
    expect(authHeader).toContain("Digest username=");
    expect(authHeader).toContain("response=");
  });
});