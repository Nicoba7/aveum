import type { BenchmarkStrategy } from "../runBenchmark";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// ------------------------------------------------------------
// Set-and-forget baseline strategy
// ------------------------------------------------------------
// Why this exists:
// - Gives us a simple, realistic baseline to compare against Aveum's canonical engine.
// - Uses fixed windows only (no dynamic optimisation, no forecasting logic).
//
// What it does:
// - EV: tries to charge during a fixed overnight window (if EV is present/connected).
// - Battery: charges during a fixed cheap window.
// - Battery: discharges during a fixed evening peak window.
//
// What it does NOT do:
// - No smart price ranking
// - No look-ahead
// - No adaptive behavior

const SLOT_HOURS = 0.5;

// Fixed windows (half-hour slot indices)
// 00:00 -> 06:00
const EV_CHARGE_WINDOW = { startInclusive: 0, endExclusive: 12 };
// 01:00 -> 04:00
const BATTERY_CHARGE_WINDOW = { startInclusive: 2, endExclusive: 8 };
// 17:00 -> 20:00
const BATTERY_DISCHARGE_WINDOW = { startInclusive: 34, endExclusive: 40 };

type SlotWindow = { startInclusive: number; endExclusive: number };

type SlotDecision = {
  slotIndex: number;
  evChargeKw: number;
  evChargeKwh: number;
  batteryChargeKw: number;
  batteryChargeKwh: number;
  batteryDischargeKw: number;
  batteryDischargeKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  importPricePencePerKwh: number;
  exportPricePencePerKwh: number;
  solarGenerationKwh: number;
  batterySocKwhEnd: number;
  batteryReserveKwh: number;
};

function isIndexInWindow(index: number, window: SlotWindow): boolean {
  // Supports normal and wrap-around windows.
  // Example wrap-around: 22:00-06:00 where start > end.
  if (window.startInclusive <= window.endExclusive) {
    return index >= window.startInclusive && index < window.endExclusive;
  }

  return index >= window.startInclusive || index < window.endExclusive;
}

function isEvAvailableAtSlot(
  slotIndex: number,
  arrivalSlotIndex: number,
  departureSlotIndex: number
): boolean {
  // EV window may cross midnight. We treat [arrival, departure) as connected period.
  // Same-day window: arrival < departure, e.g. 18:00->23:00
  // Cross-midnight: arrival > departure, e.g. 18:00->07:00
  if (arrivalSlotIndex < departureSlotIndex) {
    return slotIndex >= arrivalSlotIndex && slotIndex < departureSlotIndex;
  }

  return slotIndex >= arrivalSlotIndex || slotIndex < departureSlotIndex;
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toKwh(powerKw: number): number {
  return powerKw * SLOT_HOURS;
}

function toCost(currencyPencePerKwh: number, energyKwh: number): number {
  return (currencyPencePerKwh * energyKwh) / 100;
}

function runSetAndForgetScenario(scenario: BenchmarkScenario) {
  const slotCount = scenario.slotCount;

  const hasBattery = scenario.assets.hasBattery;
  const hasEv = scenario.assets.hasEv;
  const hasGridExport = scenario.assets.hasGridExport;

  const battery = scenario.assets.battery;
  const ev = scenario.assets.ev;

  let batterySocKwh = clamp(0, battery.initialSocKwh, battery.capacityKwh);
  let evChargeKwh = clamp(0, ev.currentChargeKwh ?? 0, ev.requiredChargeKwh);

  let totalImportKwh = 0;
  let totalExportKwh = 0;
  let totalImportCost = 0;
  let totalExportRevenue = 0;
  let totalSolarKwh = 0;
  let totalBatteryChargeKwh = 0;
  let totalBatteryDischargeKwh = 0;

  const decisions: SlotDecision[] = [];

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    // Convert kW profiles into kWh for the 30-minute slot.
    const loadKwh = toKwh(scenario.load.demandKwBySlot[slotIndex] ?? 0);
    const solarKwh = toKwh(scenario.solar.generationKwBySlot[slotIndex] ?? 0);

    totalSolarKwh += solarKwh;

    // Net energy after solar has served household load.
    // Positive means we still need energy; negative means surplus solar.
    let netDemandKwh = loadKwh - solarKwh;

    // ------------------------------------------------------------
    // EV charging (fixed overnight window only)
    // ------------------------------------------------------------
    let evChargeKw = 0;
    let evChargeKwhThisSlot = 0;
    if (hasEv) {
      const evConnected = isEvAvailableAtSlot(
        slotIndex,
        ev.arrivalSlotIndex,
        ev.departureSlotIndex
      );
      const evNeedsEnergy = evChargeKwh < ev.requiredChargeKwh;
      if (evConnected && evNeedsEnergy) {
        const evMaxKw = ev.maxChargeKw ?? 7;
        const evMaxKwhThisSlot = toKwh(evMaxKw);
        const evRemainingNeedKwh = ev.requiredChargeKwh - evChargeKwh;
        // Always try to charge in any available slot if needed
        evChargeKwhThisSlot = Math.min(evMaxKwhThisSlot, evRemainingNeedKwh);
        evChargeKw = evChargeKwhThisSlot / SLOT_HOURS;
        evChargeKwh += evChargeKwhThisSlot;
        netDemandKwh += evChargeKwhThisSlot;
      }
    }

    // ------------------------------------------------------------
    // Battery discharge (fixed evening peak window)
    // ------------------------------------------------------------
    let batteryDischargeKw = 0;
    let batteryDischargeKwhThisSlot = 0;
    if (hasBattery && isIndexInWindow(slotIndex, BATTERY_DISCHARGE_WINDOW)) {
      const maxDischargeKwhThisSlot = toKwh(Math.max(0, battery.maxDischargeKw));
      const availableAboveReserveKwh = Math.max(0, batterySocKwh - battery.reserveSocKwh);

      // Discharge only to serve demand; we do not discharge to export in this baseline.
      batteryDischargeKwhThisSlot = Math.min(
        Math.max(0, netDemandKwh),
        maxDischargeKwhThisSlot,
        availableAboveReserveKwh
      );

      if (batteryDischargeKwhThisSlot > 0) {
        batteryDischargeKw = batteryDischargeKwhThisSlot / SLOT_HOURS;
        batterySocKwh -= batteryDischargeKwhThisSlot;
        totalBatteryDischargeKwh += batteryDischargeKwhThisSlot;
        netDemandKwh -= batteryDischargeKwhThisSlot;
      }
    }

    // ------------------------------------------------------------
    // Battery charge (fixed cheap window)
    // ------------------------------------------------------------
    let batteryChargeKw = 0;
    let batteryChargeKwhThisSlot = 0;
    if (hasBattery && isIndexInWindow(slotIndex, BATTERY_CHARGE_WINDOW)) {
      const maxChargeKwhThisSlot = toKwh(Math.max(0, battery.maxChargeKw));
      const availableHeadroomKwh = Math.max(0, battery.capacityKwh - batterySocKwh);

      // Intentionally fixed behavior: always tries to charge in cheap window.
      batteryChargeKwhThisSlot = Math.min(maxChargeKwhThisSlot, availableHeadroomKwh);

      if (batteryChargeKwhThisSlot > 0) {
        batteryChargeKw = batteryChargeKwhThisSlot / SLOT_HOURS;
        batterySocKwh += batteryChargeKwhThisSlot;
        totalBatteryChargeKwh += batteryChargeKwhThisSlot;

        // Charging energy is added to demand in this slot.
        netDemandKwh += batteryChargeKwhThisSlot;
      }
    }

    // ------------------------------------------------------------
    // Grid settlement
    // ------------------------------------------------------------
    // netDemandKwh > 0  => import from grid
    // netDemandKwh < 0  => surplus (export if allowed)
    const gridImportKwh = Math.max(0, netDemandKwh);
    const gridExportKwh = hasGridExport ? Math.max(0, -netDemandKwh) : 0;

    totalImportKwh += gridImportKwh;
    totalExportKwh += gridExportKwh;

    const importPrice = scenario.tariffs.importPricesPencePerKwh[slotIndex] ?? 0;
    const exportPrice = scenario.tariffs.exportPricesPencePerKwh[slotIndex] ?? 0;

    totalImportCost += toCost(importPrice, gridImportKwh);
    totalExportRevenue += toCost(exportPrice, gridExportKwh);

    decisions.push({
      slotIndex,
      evChargeKw,
      evChargeKwh: evChargeKwhThisSlot,
      batteryChargeKw,
      batteryChargeKwh: batteryChargeKwhThisSlot,
      batteryDischargeKw,
      batteryDischargeKwh: batteryDischargeKwhThisSlot,
      gridImportKwh,
      gridExportKwh,
      importPricePencePerKwh: importPrice,
      exportPricePencePerKwh: exportPrice,
      solarGenerationKwh: solarKwh,
      batterySocKwhEnd: batterySocKwh,
      batteryReserveKwh: battery.reserveSocKwh,
    });
  }

  const totalNetCost = totalImportCost - totalExportRevenue;
  const evTargetMet = evChargeKwh >= ev.requiredChargeKwh;
  const batteryCycles =
    battery.capacityKwh > 0
      ? (totalBatteryChargeKwh + totalBatteryDischargeKwh) / (2 * battery.capacityKwh)
      : 0;

  // Simple, explainable approximation for a baseline metric:
  // "How much generated solar stayed on-site" = (solar generated - solar exported) / solar generated.
  const selfConsumptionRatio =
    totalSolarKwh > 0
      ? clamp(0, (totalSolarKwh - totalExportKwh) / totalSolarKwh, 1)
      : undefined;

  return {
    metrics: {
      totalImportCost,
      totalExportRevenue,
      totalNetCost,
      selfConsumptionRatio,
      batteryCycles,
      evTargetMet,
    },
    decisions,
    telemetry: {
      evRequiredChargeKwh: ev.requiredChargeKwh,
      batteryCapacityKwh: battery.capacityKwh,
    },
    debug: {
      strategyType: "fixed-window-baseline",
      fixedWindows: {
        evCharge: EV_CHARGE_WINDOW,
        batteryCharge: BATTERY_CHARGE_WINDOW,
        batteryDischarge: BATTERY_DISCHARGE_WINDOW,
      },
      totals: {
        totalImportKwh,
        totalExportKwh,
        totalSolarKwh,
        finalBatterySocKwh: batterySocKwh,
        finalEvChargeKwh: evChargeKwh,
      },
    },
  };
}

// Public strategy object used by runBenchmark.
export const setAndForgetStrategy: BenchmarkStrategy = {
  id: "set-and-forget",
  name: "Set and Forget",
  run: runSetAndForgetScenario,
};

export default setAndForgetStrategy;
