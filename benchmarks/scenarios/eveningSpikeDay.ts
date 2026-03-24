import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Evening spike day profile:
// - very high import prices in evening peak
// - moderate solar
// - battery discharge should be highly valuable
const importPricesPencePerKwh: number[] = [
  13.5, 13, 12.5, 12, 11.5, 11, 10.8, 10.6,
  10.4, 10.6, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23, 24,
  25, 27, 30, 34, 40, 48, 56, 64,
  72, 82, 92, 96, 88, 76, 62, 48,
  36, 28, 22, 18, 16, 15, 14.5, 14,
];

const exportPricesPencePerKwh: number[] = [
  4.5, 4.5, 4.5, 4.5, 4.5, 4.6, 4.8, 5.2,
  5.8, 6.4, 7, 7.8, 8.6, 9.5, 10.5, 11.5,
  12.5, 13.5, 14.5, 14, 13.2, 12.2, 11, 9.8,
  8.8, 7.9, 7.2, 6.7, 6.2, 5.9, 5.6, 5.3,
  5.1, 4.9, 4.8, 4.7, 4.6, 4.6, 4.5, 4.5,
  4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5,
];

const householdLoadKwBySlot: number[] = [
  0.6, 0.58, 0.55, 0.53, 0.52, 0.52, 0.55, 0.62,
  0.78, 0.92, 1.05, 1.18, 1.3, 1.42, 1.55, 1.68,
  1.82, 1.95, 2.05, 1.95, 1.82, 1.68, 1.5, 1.35,
  1.22, 1.12, 1.05, 1, 0.98, 0.98, 1.02, 1.1,
  1.35, 1.7, 2.05, 2.35, 2.58, 2.76, 2.9, 2.95,
  2.72, 2.35, 1.98, 1.62, 1.3, 1.05, 0.85, 0.72,
];

const solarGenerationKwBySlot: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0.03, 0.08, 0.16, 0.28, 0.42, 0.62, 0.85, 1.1,
  1.35, 1.6, 1.82, 2, 2.12, 2.2, 2.18, 2.05,
  1.88, 1.65, 1.4, 1.1, 0.82, 0.58, 0.38, 0.22,
  0.1, 0.04, 0.01, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

assertSlotCount("Evening-spike day import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Evening-spike day export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Evening-spike day household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Evening-spike day solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const eveningSpikeDayScenario: BenchmarkScenario = {
  id: "evening-spike-day-001",
  name: "Evening spike day",
  notes: "Extreme evening import spike where battery discharge is highly valuable.",
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
      initialSocKwh: 9,
      reserveSocKwh: 2.2,
      maxChargeKw: 5,
      maxDischargeKw: 5,
      roundTripEfficiency: 0.9,
    },
    ev: {
      arrivalSlotIndex: 36,
      departureSlotIndex: 14,
      currentChargeKwh: 12,
      requiredChargeKwh: 24,
      maxChargeKw: 7,
    },
  },
};

assertScenarioShape(eveningSpikeDayScenario);

export default eveningSpikeDayScenario;
