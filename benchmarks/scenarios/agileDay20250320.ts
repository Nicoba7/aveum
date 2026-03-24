import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Thursday 20 March 2025 (Spring Equinox).
// Import: AGILE-24-10-01 / E-1R-AGILE-24-10-01-C
// Export: AGILE-OUTGOING-19-05-13 / E-1R-AGILE-OUTGOING-19-05-13-C
// Prices in pence/kWh inc. VAT, slots 00:00→23:30 UTC.
// Notable: low afternoon prices (17–18p), sharp evening peak 16:00–18:00 (35–40p).

const importPricesPencePerKwh: number[] = [
  19.11,  20.328, 20.16,  18.543, 19.32,  17.84,  18.9,   17.871,
  19.11,  18.239, 24.024, 24.78,  23.31,  26.523, 24.875, 24.822,
  27.384, 24.78,  23.478, 21.714, 20.055, 18.239, 17.64,  17.64,
  17.64,  17.64,  17.22,  17.22,  17.64,  17.22,  18.27,  18.06,
  32.382, 35.795, 39.27,  39.9,   39.921, 40.016, 25.263, 23.835,
  20.79,  20.139, 20.328, 20.79,  19.845, 18.48,  19.32,  19.74,
];

const exportPricesPencePerKwh: number[] = [
   9.94, 10.5,   10.42,  9.69,  10.04,  9.37,  9.85,  9.39,
   9.94,  9.55,  12.17,  12.51, 11.84,  13.3,  12.55, 12.53,
  13.69, 12.51,  11.92,  11.12, 10.37,   9.55,  9.28,  9.28,
   9.28,  9.28,   9.09,   9.09,  9.28,   9.09,  9.56,  9.47,
  16.18, 17.72,  19.3,   19.58, 19.59,  19.63, 12.73, 12.08,
  10.7,  10.41,  10.5,   10.7,  10.28,   9.66, 10.04, 10.23,
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

assertSlotCount("Agile 20 Mar 2025 import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 20 Mar 2025 export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 20 Mar 2025 household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 20 Mar 2025 solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const agileDay20250320Scenario: BenchmarkScenario = {
  id: "agile-day-20250320",
  name: "Agile Day 20 Mar 2025 (Region C, Spring Equinox)",
  notes:
    "Live Octopus Agile Region C rates for 20 Mar 2025 (spring equinox). " +
    "Low afternoon floor (~17p), sharp evening peak 16:00–18:00 (35–40p). " +
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

assertScenarioShape(agileDay20250320Scenario);

export default agileDay20250320Scenario;
