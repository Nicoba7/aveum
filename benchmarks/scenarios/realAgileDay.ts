import { assertScenarioShape, assertSlotCount } from "../metrics";
import { HALF_HOUR_SLOTS_PER_DAY, type BenchmarkScenario } from "../types";

// Real Octopus Agile rates — Region C — Monday 6 January 2025.
//
// Import: product AGILE-24-10-01, tariff E-1R-AGILE-24-10-01-C
// Export: product AGILE-OUTGOING-19-05-13, tariff E-1R-AGILE-OUTGOING-19-05-13-C
//
// API endpoint used:
//   https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/
//     E-1R-AGILE-24-10-01-C/standard-unit-rates/
//     ?period_from=2025-01-06T00:00:00Z&period_to=2025-01-07T00:00:00Z
//
// Prices are value_inc_vat (pence/kWh), slots ordered 00:00→23:30 UTC.
// Key features: very cheap overnight (1.89p at 02:30), moderate daytime (~20p),
// evening peak 16:00–18:30 (34–39p).

const importPricesPencePerKwh: number[] = [
  11.34,  17.556, 11.288,  6.3,    5.313,  1.89,   5.88,   3.024,
   7.56,   5.04,   5.25,  10.08,  16.223, 20.822, 21.63,  19.95,
  22.344, 19.95,  21.0,   21.62,  22.05,  22.04,  21.21,  19.95,
  20.685, 20.769, 20.16,  20.601, 20.517, 21.315, 18.9,   20.16,
  33.6,   38.955, 37.8,   38.703, 37.8,   35.91,  24.78,  21.42,
  22.187, 21.21,  19.95,  21.63,  20.286, 17.934, 16.8,   15.75,
];

const exportPricesPencePerKwh: number[] = [
   6.43,   9.24,   6.41,   4.15,   3.7,    2.15,   3.96,   2.67,
   4.72,   3.58,   3.68,   5.86,   8.64,  10.72,  11.08,  10.32,
  11.41,  10.32,  10.8,   11.08,  11.28,  11.27,  10.9,   10.32,
  10.66,  10.7,   10.42,  10.62,  10.58,  10.94,   9.85,  10.42,
  16.73,  19.15,  18.63,  19.04,  18.63,  17.78,  12.51,  10.99,
  11.34,  10.9,   10.33,  11.08,  10.48,   9.41,   8.9,    8.42,
];

// Solar, load and asset config identical to normalWeekday.ts.
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

assertSlotCount("Real Agile day import prices", importPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Real Agile day export prices", exportPricesPencePerKwh, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Real Agile day household load", householdLoadKwBySlot, HALF_HOUR_SLOTS_PER_DAY);
assertSlotCount("Real Agile day solar generation", solarGenerationKwBySlot, HALF_HOUR_SLOTS_PER_DAY);

export const realAgileDayScenario: BenchmarkScenario = {
  id: "real-agile-day-001",
  name: "Real Agile Day (6 Jan 2025, Region C)",
  notes:
    "Live Octopus Agile rates for Region C on 6 Jan 2025. " +
    "Very cheap overnight (min 1.89p at 02:30), moderate daytime (~20p), " +
    "evening peak 16:00–18:30 (34–39p). Solar/load/assets identical to normalWeekday.",
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

assertScenarioShape(realAgileDayScenario);

export default realAgileDayScenario;
