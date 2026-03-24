import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Saturday 21 June 2025 (Summer Solstice).
// Import: AGILE-24-10-01 / E-1R-AGILE-24-10-01-C
// Export: AGILE-OUTGOING-19-05-13 / E-1R-AGILE-OUTGOING-19-05-13-C
// Prices in pence/kWh inc. VAT, slots 00:00→23:30 UTC.
// Notable: very low midday prices (9–11p), moderate evening peak 15:30–16:30 (30–35p).

const importPricesPencePerKwh: number[] = [
  18.48,  20.37,  19.436, 17.85,  17.64,  18.69,  19.005, 17.871,
  18.344, 18.344, 17.934, 18.669, 18.06,  18.123, 21.21,  21.21,
  22.05,  21.84,  19.53,  19.173, 18.039, 16.622, 13.524, 11.34,
  11.025,  9.87,  10.08,  10.08,   9.44,  10.185, 25.515, 28.665,
  32.046, 30.923, 35.49,  35.48,  24.318, 24.528, 24.864, 24.864,
  24.476, 24.245, 21.0,   19.719, 19.278, 20.16,  19.761, 18.533,
];

const exportPricesPencePerKwh: number[] = [
   9.66, 10.52,  10.09,  9.38,  9.28,  9.76,  9.9,   9.38,
   9.6,   9.6,    9.41,  9.75,  9.47,  9.5,  10.9,  10.9,
  11.28, 11.18,  10.14,  9.97,  9.46,  8.82,  7.42,  6.43,
   6.29,  5.76,   5.86,  5.86,  5.57,  5.91, 13.07, 14.5,
  16.03, 15.52,  17.58, 17.58, 12.3,  12.4,  12.55, 12.55,
  12.37, 12.27,  10.8,  10.22, 10.02, 10.42, 10.24,  9.68,
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

assertSlotCount("Agile 21 Jun 2025 import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 21 Jun 2025 export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 21 Jun 2025 household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 21 Jun 2025 solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const agileDay20250621Scenario: BenchmarkScenario = {
  id: "agile-day-20250621",
  name: "Agile Day 21 Jun 2025 (Region C, Summer Solstice)",
  notes:
    "Live Octopus Agile Region C rates for 21 Jun 2025 (summer solstice). " +
    "Very low midday prices (9–11p), moderate evening peak 15:30–16:30 (30–35p). " +
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

assertScenarioShape(agileDay20250621Scenario);

export default agileDay20250621Scenario;
