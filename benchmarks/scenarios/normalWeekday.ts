import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Normal weekday profile:
// - modest solar
// - standard overnight cheap import prices
// - normal evening peak
const importPricesPencePerKwh: number[] = [
  14.5, 14, 13.5, 13, 12.5, 12, 11.5, 11,
  10.8, 11, 11.5, 12.5, 14, 15.5, 17, 19,
  21, 23, 25, 27, 29, 31, 33, 34,
  34, 33, 31, 29, 27, 25, 23, 21,
  19, 17.5, 16, 15, 14.5, 14, 13.8, 13.5,
  13.2, 13, 12.8, 12.6, 12.4, 12.2, 12, 11.8,
];

const exportPricesPencePerKwh: number[] = [
  4.5, 4.5, 4.5, 4.5, 4.5, 4.7, 5, 5.4,
  5.9, 6.5, 7.3, 8.2, 9.5, 11, 12.5, 14,
  15.5, 16.5, 17.5, 17, 16, 14.5, 13, 11.5,
  10.2, 9.2, 8.4, 7.7, 7, 6.5, 6, 5.7,
  5.4, 5.2, 5, 4.8, 4.7, 4.6, 4.5, 4.5,
  4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5,
];

const householdLoadKwBySlot: number[] = [
  0.62, 0.58, 0.55, 0.52, 0.5, 0.5, 0.54, 0.62,
  0.78, 0.95, 1.1, 1.25, 1.38, 1.5, 1.62, 1.75,
  1.9, 2.05, 2.15, 2, 1.85, 1.65, 1.45, 1.3,
  1.18, 1.08, 1.0, 0.96, 0.92, 0.9, 0.88, 0.9,
  1.0, 1.15, 1.35, 1.58, 1.82, 2.05, 2.25, 2.35,
  2.2, 2.0, 1.75, 1.48, 1.22, 1.0, 0.82, 0.7,
];

const solarGenerationKwBySlot: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0.02, 0.05, 0.12, 0.22, 0.35, 0.52, 0.72, 0.95,
  1.22, 1.5, 1.75, 1.95, 2.1, 2.2, 2.15, 2.0,
  1.75, 1.48, 1.2, 0.95, 0.72, 0.5, 0.32, 0.18,
  0.08, 0.02, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

assertSlotCount("Normal weekday import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Normal weekday export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Normal weekday household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Normal weekday solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const normalWeekdayScenario: BenchmarkScenario = {
  id: "normal-weekday-001",
  name: "Normal weekday",
  notes: "Modest solar and a typical evening import peak.",
  timezone: "Europe/London",
  slotCount: HALF_HOUR_SLOTS_PER_DAY,
  tariffs: {
    importPricesPencePerKwh,
    exportPricesPencePerKwh,
  },
  load: {
    demandKwBySlot: householdLoadKwBySlot,
  },
  solar: {
    generationKwBySlot: solarGenerationKwBySlot,
  },
  assets: {
    hasSolar: true,
    hasBattery: true,
    hasEv: true,
    hasGridExport: true,
    battery: {
      capacityKwh: 13.5,
      initialSocKwh: 7.2,
      reserveSocKwh: 2.2,
      maxChargeKw: 5,
      maxDischargeKw: 5,
      roundTripEfficiency: 0.9,
    },
    ev: {
      arrivalSlotIndex: 35,
      departureSlotIndex: 14,
      currentChargeKwh: 10,
      requiredChargeKwh: 24,
      maxChargeKw: 7,
    },
  },
};

assertScenarioShape(normalWeekdayScenario);

export default normalWeekdayScenario;
