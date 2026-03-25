import { assertScenarioShape, assertSlotCount } from "../metrics";
import {
  HALF_HOUR_SLOTS_PER_DAY,
  type BenchmarkScenario,
} from "../types";

// Sample one-day benchmark scenario.
// These are realistic placeholder values so teams can inspect and tweak quickly.
const importPricesPencePerKwh: number[] = [
  13, 12.5, 12, 11.8, 11.5, 11.2, 11, 10.8,
  10.6, 10.8, 11.2, 12, 13, 14.5, 16, 18,
  20, 22, 24, 26, 28, 30, 32, 34,
  35, 34, 32, 30, 28, 26, 24, 22,
  20, 18, 16, 15, 14, 13.5, 13, 12.8,
  12.5, 12.2, 12, 11.8, 11.6, 11.5, 11.4, 11.3,
];

const exportPricesPencePerKwh: number[] = [
  4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.8, 5.2,
  5.8, 6.5, 7.5, 8.5, 10, 12, 14, 16,
  18, 19, 20, 19.5, 18.5, 17, 15, 13.5,
  12, 10.5, 9.5, 8.5, 7.5, 6.8, 6.2, 5.8,
  5.5, 5.2, 5, 4.8, 4.7, 4.6, 4.5, 4.5,
  4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5,
];

const householdLoadKwBySlot: number[] = [
  0.55, 0.52, 0.5, 0.48, 0.46, 0.45, 0.47, 0.5,
  0.6, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.65,
  1.8, 1.95, 2.1, 1.9, 1.7, 1.55, 1.4, 1.25,
  1.1, 1, 0.95, 0.9, 0.88, 0.86, 0.84, 0.82,
  0.85, 0.95, 1.1, 1.3, 1.55, 1.8, 2.05, 2.2,
  2, 1.8, 1.55, 1.3, 1.1, 0.9, 0.75, 0.65,
];

const solarGenerationKwBySlot: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0.05, 0.1, 0.2, 0.35, 0.55, 0.8, 1.1, 1.45,
  1.9, 2.4, 2.9, 3.3, 3.7, 4, 4.2, 4.1,
  3.8, 3.4, 2.9, 2.4, 1.9, 1.45, 1.05, 0.75,
  0.5, 0.3, 0.15, 0.08, 0.03, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

// Fail fast with clear messages if any fixture array length is wrong.
assertSlotCount("Sample scenario import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Sample scenario export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Sample scenario household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Sample scenario solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const sampleDayScenario: BenchmarkScenario = {
  id: "sample-day-001",
  name: "Sample spring weekday",
  notes: "Simple one-day fixture for comparing canonical and baseline strategies.",
  timezone: "Europe/London",
  slotCount: HALF_HOUR_SLOTS_PER_DAY,
  tariffs: {
    importPricesPencePerKwh: importPricesPencePerKwh,
    exportPricesPencePerKwh: exportPricesPencePerKwh,
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
      initialSocKwh: 6.8,
      reserveSocKwh: 2.0,
      maxChargeKw: 5,
      maxDischargeKw: 5,
      roundTripEfficiency: 0.9,
    },
    ev: {
      // 18:00 arrival (slot 36), 07:00 departure next day (slot 14 interpreted by strategy logic).
      // Keeping this simple now; strategy implementations can decide exact cross-midnight handling.
      arrivalSlotIndex: 36,
      departureSlotIndex: 14,
      currentChargeKwh: 12,
      requiredChargeKwh: 24,
      maxChargeKw: 7,
    },
  },
};

// Extra guard for anyone importing this scenario directly.
assertScenarioShape(sampleDayScenario);

export default sampleDayScenario;
