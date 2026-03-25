import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Negative price day profile:
// - several negative import slots around midday
// - good solar generation
// - strong incentive to charge battery/EV aggressively
const importPricesPencePerKwh: number[] = [
  12.5, 12, 11.5, 11, 10.5, 10, 9.5, 9,
  8.5, 7.5, 6, 3, 0, -1.5, -3, -4,
  -4.5, -3.5, -2, -0.8, 1.5, 3.5, 6, 8.5,
  11, 13, 15, 18, 22, 26, 30, 34,
  38, 40, 42, 40, 36, 30, 24, 19,
  16, 14, 13, 12.5, 12, 11.8, 11.5, 11,
];

const exportPricesPencePerKwh: number[] = [
  4.8, 4.8, 4.8, 4.8, 5, 5.2, 5.6, 6.2,
  7.2, 8.5, 10, 12, 14, 16, 18, 20,
  22, 23, 23.5, 22, 20, 17, 14, 11,
  9, 8, 7.2, 6.5, 6, 5.7, 5.4, 5.2,
  5, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8,
  4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8,
];

const householdLoadKwBySlot: number[] = [
  0.58, 0.55, 0.52, 0.5, 0.48, 0.5, 0.56, 0.66,
  0.84, 1.0, 1.12, 1.22, 1.32, 1.42, 1.52, 1.62,
  1.75, 1.88, 1.95, 1.85, 1.72, 1.55, 1.38, 1.22,
  1.1, 1.02, 0.95, 0.9, 0.88, 0.9, 0.95, 1.02,
  1.2, 1.42, 1.7, 1.98, 2.22, 2.42, 2.56, 2.62,
  2.4, 2.12, 1.82, 1.52, 1.24, 1.0, 0.82, 0.68,
];

const solarGenerationKwBySlot: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0.06, 0.15, 0.3, 0.55, 0.9, 1.35, 1.9, 2.5,
  3.1, 3.7, 4.25, 4.75, 5.1, 5.3, 5.2, 4.95,
  4.6, 4.15, 3.6, 2.95, 2.3, 1.7, 1.15, 0.75,
  0.42, 0.2, 0.08, 0.02, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

assertSlotCount("Negative-price day import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Negative-price day export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Negative-price day household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Negative-price day solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const negativePriceDayScenario: BenchmarkScenario = {
  id: "negative-price-day-001",
  name: "Negative price day",
  notes: "Midday negative import prices with strong charging incentives.",
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
      initialSocKwh: 5.5,
      reserveSocKwh: 2.0,
      maxChargeKw: 5,
      maxDischargeKw: 5,
      roundTripEfficiency: 0.9,
    },
    ev: {
      arrivalSlotIndex: 34,
      departureSlotIndex: 14,
      currentChargeKwh: 8,
      requiredChargeKwh: 24,
      maxChargeKw: 7,
    },
  },
};

assertScenarioShape(negativePriceDayScenario);

export default negativePriceDayScenario;
