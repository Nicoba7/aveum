import { describe, expect, it } from "vitest";
import type { DeviceState, OptimizerInput, OptimizationMode } from "../domain";
import { optimize } from "../optimizer/engine";

function buildDevices(): DeviceState[] {
  return [
    {
      deviceId: "battery-1",
      kind: "battery",
      brand: "GivEnergy",
      name: "Battery",
      connectionStatus: "online",
      lastUpdatedAt: "2026-03-16T10:00:00.000Z",
      capabilities: ["set_mode", "read_power", "read_soc"],
      capacityKwh: 10,
    },
    {
      deviceId: "solar-1",
      kind: "solar_inverter",
      brand: "SolarEdge",
      name: "Solar",
      connectionStatus: "online",
      lastUpdatedAt: "2026-03-16T10:00:00.000Z",
      capabilities: ["read_power", "read_energy"],
    },
    {
      deviceId: "grid-1",
      kind: "smart_meter",
      brand: "Octopus",
      name: "Grid",
      connectionStatus: "online",
      lastUpdatedAt: "2026-03-16T10:00:00.000Z",
      capabilities: ["read_tariff", "read_power"],
    },
  ];
}

function buildInput(params: {
  mode: OptimizationMode;
  importRates: number[];
  exportRates: number[];
  loadKwh: number;
  solarKwh: number;
}): OptimizerInput {
  const start = new Date("2026-03-16T10:00:00.000Z").getTime();

  return {
    systemState: {
      siteId: "site-1",
      capturedAt: "2026-03-16T10:00:00.000Z",
      timezone: "Europe/London",
      devices: buildDevices(),
      homeLoadW: Math.round(params.loadKwh * 2000),
      solarGenerationW: Math.round(params.solarKwh * 2000),
      batteryPowerW: 0,
      evChargingPowerW: 0,
      gridPowerW: 0,
      batterySocPercent: 60,
      batteryCapacityKwh: 10,
      evConnected: false,
    },
    forecasts: {
      generatedAt: "2026-03-16T10:00:00.000Z",
      horizonStartAt: "2026-03-16T10:00:00.000Z",
      horizonEndAt: new Date(start + params.importRates.length * 30 * 60 * 1000).toISOString(),
      slotDurationMinutes: 30,
      householdLoadKwh: params.importRates.map((_, index) => ({
        startAt: new Date(start + index * 30 * 60 * 1000).toISOString(),
        endAt: new Date(start + (index + 1) * 30 * 60 * 1000).toISOString(),
        value: params.loadKwh,
        confidence: 0.9,
      })),
      solarGenerationKwh: params.importRates.map((_, index) => ({
        startAt: new Date(start + index * 30 * 60 * 1000).toISOString(),
        endAt: new Date(start + (index + 1) * 30 * 60 * 1000).toISOString(),
        value: params.solarKwh,
        confidence: 0.9,
      })),
      carbonIntensity: params.importRates.map((_, index) => ({
        startAt: new Date(start + index * 30 * 60 * 1000).toISOString(),
        endAt: new Date(start + (index + 1) * 30 * 60 * 1000).toISOString(),
        value: 200,
        confidence: 0.9,
      })),
    },
    tariffSchedule: {
      tariffId: "tariff-1",
      provider: "Gridly",
      name: "Synthetic",
      currency: "GBP",
      updatedAt: "2026-03-16T10:00:00.000Z",
      importRates: params.importRates.map((rate, index) => ({
        startAt: new Date(start + index * 30 * 60 * 1000).toISOString(),
        endAt: new Date(start + (index + 1) * 30 * 60 * 1000).toISOString(),
        unitRatePencePerKwh: rate,
        source: "live",
      })),
      exportRates: params.exportRates.map((rate, index) => ({
        startAt: new Date(start + index * 30 * 60 * 1000).toISOString(),
        endAt: new Date(start + (index + 1) * 30 * 60 * 1000).toISOString(),
        unitRatePencePerKwh: rate,
        source: "live",
      })),
    },
    constraints: {
      mode: params.mode,
      batteryReservePercent: 30,
      maxBatteryCyclesPerDay: 2,
      allowGridBatteryCharging: true,
      allowBatteryExport: true,
      allowAutomaticEvCharging: false,
      evTargetSocPercent: 85,
      evReadyBy: "07:00",
    },
  };
}

describe("optimize mode-aware objective behavior", () => {
  it("prefers export in cost mode but keeps solar for self consumption mode", () => {
    const costResult = optimize(
      buildInput({
        mode: "cost",
        importRates: [20],
        exportRates: [18],
        loadKwh: 1,
        solarKwh: 3,
      }),
    );

    const selfResult = optimize(
      buildInput({
        mode: "self_consumption",
        importRates: [20],
        exportRates: [18],
        loadKwh: 1,
        solarKwh: 3,
      }),
    );

    expect(costResult.decisions[0]?.action).toBe("export_to_grid");
    expect(selfResult.decisions[0]?.action).toBe("consume_solar");
  });

  it("allows battery charging in cost mode at moderate import prices", () => {
    const costResult = optimize(
      buildInput({
        mode: "cost",
        importRates: [9, 10],
        exportRates: [6, 6],
        loadKwh: 1,
        solarKwh: 0,
      }),
    );

    const balancedResult = optimize(
      buildInput({
        mode: "balanced",
        importRates: [9, 10],
        exportRates: [6, 6],
        loadKwh: 1,
        solarKwh: 0,
      }),
    );

    expect(costResult.decisions[0]?.action).toBe("charge_battery");
    expect(balancedResult.decisions[0]?.action).toBe("hold");
  });
});
