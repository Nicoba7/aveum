import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Monday 22 December 2025 (near Winter Solstice).
// Import: AGILE-24-10-01 / E-1R-AGILE-24-10-01-C
// Export: AGILE-OUTGOING-19-05-13 / E-1R-AGILE-OUTGOING-19-05-13-C
// Prices in pence/kWh inc. VAT, slots 00:00→23:30 UTC.
// Notable: moderate overnight (11–13p), afternoon/evening peak 16:00–18:00 (31–33p).

const importPricesPencePerKwh: number[] = [
  12.128, 13.02,  12.684, 11.445, 11.204, 11.781, 12.422, 11.781,
  12.18,  10.08,  12.947, 13.44,  14.238, 15.015, 17.115, 18.48,
  16.863, 17.85,  17.241, 17.682, 16.769, 17.052, 17.64,  16.674,
  17.367, 17.451, 18.144, 18.291, 19.74,  20.318, 18.606, 20.139,
  32.634, 33.443, 32.97,  33.39,  32.424, 31.595, 18.942, 17.955,
  17.367, 17.22,  17.409, 16.926, 15.96,  14.28,  17.22,  15.929,
];

const exportPricesPencePerKwh: number[] = [
  6.79, 7.19, 7.04, 6.48, 6.37, 6.63, 6.92, 6.63,
  6.81, 5.86, 7.16, 7.38, 7.74, 8.09, 9.04, 9.66,
  8.93, 9.38, 9.1,  9.3,  8.88, 9.01, 9.28, 8.84,
  9.16, 9.19, 9.51, 9.58, 10.23, 10.49, 9.72, 10.41,
  16.29, 16.66, 16.44, 16.64, 16.2, 15.82, 9.87, 9.42,
  9.16, 9.09, 9.18, 8.96, 8.52, 7.76, 9.09, 8.51,
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

assertSlotCount("Agile 22 Dec 2025 import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 22 Dec 2025 export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 22 Dec 2025 household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 22 Dec 2025 solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const agileDay20251222Scenario: BenchmarkScenario = {
  id: "agile-day-20251222",
  name: "Agile Day 22 Dec 2025 (Region C, near Winter Solstice)",
  notes:
    "Live Octopus Agile Region C rates for 22 Dec 2025 (near winter solstice). " +
    "Moderate overnight (11–13p), afternoon/evening peak 16:00–18:00 (31–33p). " +
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

assertScenarioShape(agileDay20251222Scenario);

export default agileDay20251222Scenario;
