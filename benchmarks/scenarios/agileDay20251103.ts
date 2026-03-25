import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Monday 3 November 2025.
// Import: AGILE-24-10-01 / E-1R-AGILE-24-10-01-C
// Export: AGILE-OUTGOING-19-05-13 / E-1R-AGILE-OUTGOING-19-05-13-C
// Prices in pence/kWh inc. VAT, slots 00:00→23:30 UTC.
// Notable: very cheap overnight (min 0.21p at 23:30!), moderate evening peak 16:00–18:00 (29–34p).

const importPricesPencePerKwh: number[] = [
   6.311,  7.445,  6.678,  3.738,  4.326,  2.457,  3.969,  2.342,
   2.909,  3.57,   4.82,   4.83,   9.765, 16.8,   14.301, 17.892,
  16.212, 18.06,  16.958, 16.212, 13.755, 13.797, 13.703, 13.073,
  13.104, 12.747, 13.734, 13.272, 14.448, 14.07,  13.23,  16.097,
  29.862, 34.02,  30.345, 30.293, 30.797, 29.82,  15.876, 13.146,
  13.314, 10.217, 10.259,  6.006,  6.993,  4.337,  3.665,  0.21,
];

const exportPricesPencePerKwh: number[] = [
  4.15, 4.67, 4.32, 2.99, 3.26, 2.41, 3.1,  2.36,
  2.61, 2.92, 3.48, 3.48, 5.72, 8.9,  7.77, 9.39,
  8.63, 9.47, 8.97, 8.63, 7.52, 7.54, 7.5,  7.21,
  7.23, 7.07, 7.51, 7.3,  7.84, 7.66, 7.28, 8.58,
  15.04, 16.92, 15.26, 15.23, 15.46, 15.02, 8.48, 7.25,
  7.32, 5.92, 5.94, 4.02, 4.46, 3.26, 2.96, 1.4,
];

// Solar, load and assets identical to normalWeekday.ts.
const householdLoadKwBySlot: number[] = [
  0.62, 0.58, 0.55, 0.52, 0.5,  0.5,  0.54, 0.62,
  0.78, 0.95, 1.1,  1.25, 1.38, 1.5,  1.62, 1.75,
  1.9,  2.05, 2.15, 2.0,  1.85, 1.65, 1.45, 1.3,
  1.18, 1.08, 1.0,  0.96, 0.92, 0.9,  0.88, 0.9,
  1.0,  1.15, 1.35, 1.58, 1.82, 2.05, 2.25, 2.35,
  2.2,  2.0,  1.75, 1.48, 1.22, 1.0,  0.82, 0.7,
];

const solarGenerationKwBySlot: number[] = [
  0,    0,    0,    0,    0,    0,    0,    0,
  0.02, 0.05, 0.12, 0.22, 0.35, 0.52, 0.72, 0.95,
  1.22, 1.5,  1.75, 1.95, 2.1,  2.2,  2.15, 2.0,
  1.75, 1.48, 1.2,  0.95, 0.72, 0.5,  0.32, 0.18,
  0.08, 0.02, 0,    0,    0,    0,    0,    0,
  0,    0,    0,    0,    0,    0,    0,    0,
];

assertSlotCount("Agile 3 Nov 2025 import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 3 Nov 2025 export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 3 Nov 2025 household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 3 Nov 2025 solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const agileDay20251103Scenario: BenchmarkScenario = {
  id: "agile-day-20251103",
  name: "Agile Day 3 Nov 2025 (Region C)",
  notes:
    "Live Octopus Agile Region C rates for 3 Nov 2025. " +
    "Extremely cheap overnight (min 0.21p at 23:30), moderate evening peak 16:00–18:00 (29–34p). " +
    "Solar/load/assets identical to normalWeekday.",
  timezone: "Europe/London",
  slotCount: HALF_HOUR_SLOTS_PER_DAY,
  tariffs: { importPricesPencePerKwh, exportPricesPencePerKwh },
  load: { demandKwBySlot: householdLoadKwBySlot },
  solar: { generationKwBySlot: solarGenerationKwBySlot },
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

assertScenarioShape(agileDay20251103Scenario);

export default agileDay20251103Scenario;
