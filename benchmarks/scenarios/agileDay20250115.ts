import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Wednesday 15 January 2025.
// Import: AGILE-24-10-01 / E-1R-AGILE-24-10-01-C
// Export: AGILE-OUTGOING-19-05-13 / E-1R-AGILE-OUTGOING-19-05-13-C
// Prices in pence/kWh inc. VAT, slots 00:00→23:30 UTC.
// Notable: persistently high overnight (~20p), extreme evening peak 16:00–18:00 (47–51p).

const importPricesPencePerKwh: number[] = [
  19.908, 21.021, 19.908, 19.908, 19.908, 19.887, 19.856, 19.908,
  19.908, 19.908, 23.1,   20.391, 21.0,   23.52,  27.09,  27.846,
  29.19,  29.4,   28.35,  28.56,  27.216, 26.849, 25.41,  24.36,
  25.2,   25.872, 25.526, 24.927, 23.1,   25.568, 24.591, 29.316,
  40.488, 47.25,  49.413, 50.82,  48.3,   45.203, 29.82,  24.78,
  26.649, 23.415, 24.528, 20.423, 19.908, 19.173, 21.42,  20.769,
];

const exportPricesPencePerKwh: number[] = [
  10.31, 10.81, 10.31, 10.31, 10.31, 10.3,  10.28, 10.31,
  10.31, 10.31, 11.75, 10.52, 10.8,  11.94, 13.56, 13.9,
  14.5,  14.6,  14.12, 14.22, 13.61, 13.45, 12.8,  12.32,
  12.7,  13.0,  12.85, 12.57, 11.75, 12.87, 12.42, 14.56,
  19.85, 22.9,  23.88, 24.52, 23.38, 21.98, 14.79, 12.51,
  13.36, 11.89, 12.4,  10.54, 10.31,  9.97, 10.99, 10.7,
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

assertSlotCount("Agile 15 Jan 2025 import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 15 Jan 2025 export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 15 Jan 2025 household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Agile 15 Jan 2025 solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const agileDay20250115Scenario: BenchmarkScenario = {
  id: "agile-day-20250115",
  name: "Agile Day 15 Jan 2025 (Region C)",
  notes:
    "Live Octopus Agile Region C rates for 15 Jan 2025. " +
    "High overnight floor (~20p), extreme evening peak 16:00–18:00 (47–51p). " +
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

assertScenarioShape(agileDay20250115Scenario);

export default agileDay20250115Scenario;
