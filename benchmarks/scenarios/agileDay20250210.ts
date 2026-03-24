import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Monday 10 February 2025.
// Import: AGILE-24-10-01 / E-1R-AGILE-24-10-01-C
// Export: AGILE-OUTGOING-19-05-13 / E-1R-AGILE-OUTGOING-19-05-13-C
// Prices in pence/kWh inc. VAT, slots 00:00→23:30 UTC.
// Notable: elevated overnight (~21p), evening peak 16:00–18:00 (42–46p).

const importPricesPencePerKwh: number[] = [
  21.0,   23.625, 23.1,   21.0,   21.42,  21.0,   21.0,   20.16,
  21.504, 20.496, 23.877, 23.352, 24.465, 26.04,  26.25,  30.24,
  27.909, 28.056, 28.413, 27.993, 26.376, 25.557, 26.04,  24.927,
  23.961, 23.793, 23.646, 22.848, 24.381, 23.562, 22.05,  24.15,
  34.23,  42.0,   41.234, 44.1,   46.127, 42.063, 29.4,   26.25,
  26.25,  24.15,  27.279, 23.825, 23.52,  23.1,   24.686, 23.1,
];

const exportPricesPencePerKwh: number[] = [
  10.8,  11.99, 11.75, 10.8,  10.99, 10.8,  10.8,  10.42,
  11.03, 10.57, 12.1,  11.86, 12.37, 13.08, 13.18, 14.98,
  13.93, 13.99, 14.15, 13.96, 13.23, 12.86, 13.08, 12.58,
  12.14, 12.07, 12.0,  11.64, 12.33, 11.96, 11.28, 12.22,
  17.02, 20.53, 20.18, 21.48, 22.4,  20.56, 14.6,  13.18,
  13.18, 12.22, 13.64, 12.08, 11.94, 11.75, 12.47, 11.75,
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

assertSlotCount("Agile 10 Feb 2025 import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 10 Feb 2025 export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 10 Feb 2025 household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 10 Feb 2025 solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const agileDay20250210Scenario: BenchmarkScenario = {
  id: "agile-day-20250210",
  name: "Agile Day 10 Feb 2025 (Region C)",
  notes:
    "Live Octopus Agile Region C rates for 10 Feb 2025. " +
    "Elevated overnight (~21–24p), evening peak 16:00–18:00 (42–46p). " +
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

assertScenarioShape(agileDay20250210Scenario);

export default agileDay20250210Scenario;
