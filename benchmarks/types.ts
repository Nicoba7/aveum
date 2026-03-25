// Aveum benchmark core types
// ------------------------------------------------------------
// This file defines the shared contracts for benchmark inputs
// (scenarios), strategy outputs, and comparison metrics.
// The goal is to keep this easy to read and easy to extend.

export const HALF_HOUR_SLOTS_PER_DAY = 48;

// Generic number series for one day of half-hour slots.
// Example: index 0 = 00:00-00:30, index 1 = 00:30-01:00, etc.
export type DailySlotSeries = number[];

// Hardware and controllable asset limits available in a scenario.
export interface AssetCapabilities {
  hasSolar: boolean;
  hasBattery: boolean;
  hasEv: boolean;
  hasGridExport: boolean;
  battery: BatteryState;
  ev: EVState;
}

// Battery starting state and hard operating limits.
export interface BatteryState {
  capacityKwh: number;
  initialSocKwh: number;
  reserveSocKwh: number;
  maxChargeKw: number;
  maxDischargeKw: number;
  roundTripEfficiency?: number;
}

// EV charging window and target for the day.
export interface EVState {
  arrivalSlotIndex: number;
  departureSlotIndex: number;
  requiredChargeKwh: number;
  currentChargeKwh?: number;
  maxChargeKw?: number;
}

// Forecast solar generation profile in kW for each half-hour slot.
export interface SolarProfile {
  generationKwBySlot: DailySlotSeries;
}

// Household demand profile in kW for each half-hour slot.
export interface LoadProfile {
  demandKwBySlot: DailySlotSeries;
}

// Import/export tariff profile for each half-hour slot.
export interface TariffProfile {
  importPricesPencePerKwh: DailySlotSeries;
  exportPricesPencePerKwh: DailySlotSeries;
}

// One benchmark scenario = one day + all constraints and prices.
export interface BenchmarkScenario {
  id: string;
  name: string;
  notes?: string;
  timezone?: string;
  slotCount: number;
  tariffs: TariffProfile;
  solar: SolarProfile;
  load: LoadProfile;
  assets: AssetCapabilities;
}

// Core metrics used to compare strategy outcomes.
export interface BenchmarkMetrics {
  totalImportCost: number;
  totalExportRevenue: number;
  totalNetCost: number;
  evTargetMissPenalty?: number;
  adjustedNetEnergyCost?: number;
  selfConsumptionRatio?: number;
  batteryCycles?: number;
  evTargetMet?: boolean;
}

// Per-slot trace emitted by a strategy run.
// This is benchmark-only data so we can calculate comparable metrics consistently.
export interface StrategyDecisionSlot {
  slotIndex: number;
  importPricePencePerKwh?: number;
  exportPricePencePerKwh?: number;
  gridImportKwh?: number;
  gridExportKwh?: number;
  solarGenerationKwh?: number;
  evChargeKwh?: number;
  batteryChargeKwh?: number;
  batteryDischargeKwh?: number;
  batterySocKwhEnd?: number;
  batteryReserveKwh?: number;
}

// Small strategy-level context needed to compute derived metrics.
export interface StrategyTelemetry {
  evRequiredChargeKwh?: number;
  batteryCapacityKwh?: number;
}

// One strategy's output for one scenario.
// We keep decisions generic for now until execution format is finalized.
export interface StrategyResult {
  strategyId: string;
  strategyName: string;
  scenarioId: string;
  metrics: BenchmarkMetrics;
  decisions?: StrategyDecisionSlot[];
  telemetry?: StrategyTelemetry;
  debug?: Record<string, unknown>;
}

// Compact row shape intended for table-style rendering in CLI or reports.
export interface StrategyComparisonRow {
  strategyId: string;
  strategyName: string;
  totalImportCost: number;
  totalExportRevenue: number;
  netEnergyCost: number;
  evTargetMissPenalty: number;
  adjustedNetEnergyCost: number;
  evEnergyDeliveredKwh: number;
  evTargetAchieved: boolean;
  batteryThroughputKwh: number;
  estimatedBatteryCycles?: number;
  solarSelfConsumption?: number;
  solarSpillExportKwh: number;
  negativePriceCaptureKwh: number;
  reserveViolationsCount: number;
}

export interface StrategyComparisonTable {
  rows: StrategyComparisonRow[];
  bestNetEnergyCostStrategyId?: string;
}

// Final benchmark report for a scenario.
export interface BenchmarkResult {
  scenarioId: string;
  scenarioName: string;
  generatedAtIso: string;
  strategyResults: StrategyResult[];
  winnerStrategyId?: string;
}
