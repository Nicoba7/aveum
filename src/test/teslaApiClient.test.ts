import { describe, expect, it, vi } from "vitest";
import { TeslaHttpApiClient, TeslaTransportError } from "../adapters/tesla/TeslaApiClient";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TeslaHttpApiClient", () => {
  it("sends start charging request and parses successful response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ response: { result: true, reason: "ok" } }));
    const client = new TeslaHttpApiClient({
      accessToken: "token",
      fetchFn,
      baseUrl: "https://tesla.example",
    });

    const result = await client.startCharging({ vehicleId: "v1" });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://tesla.example/api/1/vehicles/v1/command/charge_start",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ result: true, reason: "ok" });
  });

  it("reads charging telemetry and parses expected payload", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({
      response: {
        charge_state: {
          timestamp: 1710583500000,
          charging_state: "Charging",
          charge_port_latch: "Engaged",
          charger_power: 7.2,
          battery_level: 66,
        },
      },
    }));
    const client = new TeslaHttpApiClient({
      accessToken: "token",
      fetchFn,
      baseUrl: "https://tesla.example",
    });

    const telemetry = await client.readChargingTelemetry({ vehicleId: "v1" });

    expect(telemetry).toEqual({
      vehicleId: "v1",
      timestamp: "2024-03-16T10:05:00.000Z",
      chargingState: "Charging",
      chargePortLatch: "Engaged",
      chargerPowerKw: 7.2,
      batteryLevel: 66,
    });
  });

  it("throws MALFORMED_RESPONSE when charge command payload is invalid", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ response: { ok: true } }));
    const client = new TeslaHttpApiClient({ accessToken: "token", fetchFn });

    await expect(client.startCharging({ vehicleId: "v1" })).rejects.toMatchObject({
      name: "TeslaTransportError",
      code: "MALFORMED_RESPONSE",
    } satisfies Partial<TeslaTransportError>);
  });

  it("throws AUTH_FAILURE on unauthorized response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "unauthorized" }, 401));
    const client = new TeslaHttpApiClient({ accessToken: "token", fetchFn });

    await expect(client.stopCharging({ vehicleId: "v1" })).rejects.toMatchObject({
      name: "TeslaTransportError",
      code: "AUTH_FAILURE",
    } satisfies Partial<TeslaTransportError>);
  });

  it("throws RATE_LIMIT on rate-limited response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "rate_limited" }, 429));
    const client = new TeslaHttpApiClient({ accessToken: "token", fetchFn });

    await expect(client.startCharging({ vehicleId: "v1" })).rejects.toMatchObject({
      name: "TeslaTransportError",
      code: "RATE_LIMIT",
    } satisfies Partial<TeslaTransportError>);
  });

  it("throws TEMPORARY_UNAVAILABLE on server unavailable response", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "unavailable" }, 503));
    const client = new TeslaHttpApiClient({ accessToken: "token", fetchFn });

    await expect(client.startCharging({ vehicleId: "v1" })).rejects.toMatchObject({
      name: "TeslaTransportError",
      code: "TEMPORARY_UNAVAILABLE",
    } satisfies Partial<TeslaTransportError>);
  });

  it("throws TIMEOUT when fetch aborts", async () => {
    const fetchFn = vi.fn(async () => {
      const error = new Error("aborted");
      (error as { name?: string }).name = "AbortError";
      throw error;
    });
    const client = new TeslaHttpApiClient({ accessToken: "token", fetchFn });

    await expect(client.startCharging({ vehicleId: "v1" })).rejects.toMatchObject({
      name: "TeslaTransportError",
      code: "TIMEOUT",
    } satisfies Partial<TeslaTransportError>);
  });
});
