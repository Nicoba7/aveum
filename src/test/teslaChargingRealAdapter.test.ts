import { describe, expect, it, vi } from "vitest";
import { TeslaChargingRealAdapter } from "../adapters/tesla/TeslaChargingRealAdapter";
import { runRealDeviceAdapterContractHarness } from "./harness/realDeviceAdapterContractHarness";

const startChargingCommand = {
  kind: "start_charging" as const,
  targetDeviceId: "tesla-vehicle-1",
};

runRealDeviceAdapterContractHarness({
  suiteName: "TeslaChargingRealAdapter contract harness",
  createAdapter: () => new TeslaChargingRealAdapter({
    supportedVehicleIds: ["tesla-vehicle-1"],
    client: {
      startCharging: vi.fn(async () => ({ result: true, reason: "ok" })),
      stopCharging: vi.fn(async () => ({ result: true, reason: "ok" })),
      readChargingTelemetry: vi.fn(async () => ({
        vehicleId: "tesla-vehicle-1",
        timestamp: "2026-03-16T10:05:00.000Z",
        chargingState: "Charging",
        chargePortLatch: "Engaged",
        chargerPowerKw: 7.2,
        batteryLevel: 64,
      })),
    },
  }),
  supportedDeviceId: "tesla-vehicle-1",
  unsupportedDeviceId: "tesla-vehicle-2",
  canonicalCommand: startChargingCommand,
  vendorTelemetryPayload: {
    vehicleId: "tesla-vehicle-1",
    timestamp: "2026-03-16T10:05:00.000Z",
    chargingState: "Charging",
    chargePortLatch: "Engaged",
    chargerPowerKw: 7.2,
    batteryLevel: 64,
  },
  vendorErrorSample: {
    status: 401,
    code: "UNAUTHORIZED",
    message: "token expired",
  },
});

describe("TeslaChargingRealAdapter", () => {
  it("dispatches start_charging and stop_charging as Tesla charge commands", async () => {
    const startCharging = vi.fn(async () => ({ result: true, reason: "ok" }));
    const stopCharging = vi.fn(async () => ({ result: true, reason: "ok" }));
    const adapter = new TeslaChargingRealAdapter({
      supportedVehicleIds: ["tesla-vehicle-1"],
      client: {
        startCharging,
        stopCharging,
        readChargingTelemetry: vi.fn(async () => ({
          vehicleId: "tesla-vehicle-1",
          timestamp: "2026-03-16T10:05:00.000Z",
        })),
      },
    });

    await adapter.executeCanonicalCommand({
      kind: "start_charging",
      targetDeviceId: "tesla-vehicle-1",
    });

    await adapter.executeCanonicalCommand({
      kind: "stop_charging",
      targetDeviceId: "tesla-vehicle-1",
    });

    expect(startCharging).toHaveBeenNthCalledWith(1, { vehicleId: "tesla-vehicle-1" });
    expect(stopCharging).toHaveBeenNthCalledWith(1, { vehicleId: "tesla-vehicle-1" });
  });

  it("rejects unsupported canonical command kinds explicitly", async () => {
    const adapter = new TeslaChargingRealAdapter({
      supportedVehicleIds: ["tesla-vehicle-1"],
      client: {
        startCharging: vi.fn(async () => ({ result: true })),
        stopCharging: vi.fn(async () => ({ result: true })),
        readChargingTelemetry: vi.fn(async () => ({
          vehicleId: "tesla-vehicle-1",
          timestamp: "2026-03-16T10:05:00.000Z",
        })),
      },
    });

    const result = await adapter.executeCanonicalCommand({
      kind: "set_mode",
      targetDeviceId: "tesla-vehicle-1",
      mode: "charge",
    });

    expect(result.status).toBe("rejected");
    expect(result.failureReasonCode).toBe("COMMAND_REJECTED");
  });

  it("maps Tesla telemetry payload into canonical telemetry fields", () => {
    const adapter = new TeslaChargingRealAdapter({
      supportedVehicleIds: ["tesla-vehicle-1"],
      client: {
        startCharging: vi.fn(async () => ({ result: true })),
        stopCharging: vi.fn(async () => ({ result: true })),
        readChargingTelemetry: vi.fn(async () => ({
          vehicleId: "tesla-vehicle-1",
          timestamp: "2026-03-16T10:05:00.000Z",
        })),
      },
    });

    const [event] = adapter.mapVendorTelemetryToCanonicalTelemetry({
      vehicleId: "tesla-vehicle-1",
      timestamp: "2026-03-16T10:05:00.000Z",
      chargingState: "Charging",
      chargePortLatch: "Engaged",
      chargerPowerKw: 5,
      batteryLevel: 72,
    });

    expect(event).toEqual({
      deviceId: "tesla-vehicle-1",
      timestamp: "2026-03-16T10:05:00.000Z",
      batterySocPercent: 72,
      evChargingPowerW: 5000,
      chargingState: "charging",
      evConnected: true,
      schemaVersion: "telemetry.v1",
    });
  });

  it("maps Tesla API failure to canonical failed command result", async () => {
    const adapter = new TeslaChargingRealAdapter({
      supportedVehicleIds: ["tesla-vehicle-1"],
      client: {
        startCharging: vi.fn(async () => {
          throw { status: 429, code: "RATE_LIMIT" };
        }),
        stopCharging: vi.fn(async () => ({ result: true })),
        readChargingTelemetry: vi.fn(async () => ({
          vehicleId: "tesla-vehicle-1",
          timestamp: "2026-03-16T10:05:00.000Z",
        })),
      },
    });

    const result = await adapter.executeCanonicalCommand({
      kind: "start_charging",
      targetDeviceId: "tesla-vehicle-1",
    });

    expect(result.status).toBe("failed");
    expect(result.failureReasonCode).toBe("COMMAND_FAILED");
  });

  it("reads Tesla charging telemetry through transport seam", async () => {
    const readChargingTelemetry = vi.fn(async () => ({
      vehicleId: "tesla-vehicle-1",
      timestamp: "2026-03-16T10:05:00.000Z",
      chargingState: "Charging",
      batteryLevel: 77,
    }));
    const adapter = new TeslaChargingRealAdapter({
      supportedVehicleIds: ["tesla-vehicle-1"],
      client: {
        startCharging: vi.fn(async () => ({ result: true })),
        stopCharging: vi.fn(async () => ({ result: true })),
        readChargingTelemetry,
      },
    });

    const telemetry = await adapter.readVendorChargingTelemetry("tesla-vehicle-1");

    expect(readChargingTelemetry).toHaveBeenCalledWith({ vehicleId: "tesla-vehicle-1" });
    expect(telemetry.batteryLevel).toBe(77);
  });
});
