import type {
  BenchmarkMetrics,
  BenchmarkScenario,
  StrategyComparisonRow,
  StrategyComparisonTable,
  StrategyDecisionSlot,
  StrategyResult,
} from "./types";

// Lightweight guard: confirms a series has exactly one day of half-hour values.
// This is intentionally simple and can be expanded with stricter validation later.
export function isHalfHourDay(series: number[], slotCount = 48): boolean {
  return Array.isArray(series) && series.length === slotCount;
}

// Throws a clear, human-readable error when a daily series does not have 48 slots.
// This keeps fixture mistakes obvious during setup.
export function assertSlotCount(
  label: string,
  series: number[],
  slotCount = 48
): void {
  if (!Array.isArray(series)) {
    throw new Error(`${label} must be an array with ${slotCount} half-hour values.`);
  }

  if (series.length !== slotCount) {
    throw new Error(
      `${label} must have exactly ${slotCount} half-hour values, but got ${series.length}.`
    );
  }
}

// Basic scenario shape checks so bad benchmark fixtures fail early.
export function validateScenarioShape(scenario: BenchmarkScenario): string[] {
  const errors: string[] = [];
  const expectedSlots = scenario.slotCount;

  const slotChecks: Array<{ label: string; series: number[] }> = [
    {
      label: "Import prices",
      series: scenario.tariffs.importPricesPencePerKwh,
    },
    {
      label: "Export prices",
      series: scenario.tariffs.exportPricesPencePerKwh,
    },
    {
      label: "Solar generation",
      series: scenario.solar.generationKwBySlot,
    },
    {
      label: "Household demand",
      series: scenario.load.demandKwBySlot,
    },
  ];

  for (const check of slotChecks) {
    if (!isHalfHourDay(check.series, expectedSlots)) {
      errors.push(
        `${check.label} must have exactly ${expectedSlots} half-hour values (got ${check.series.length}).`
      );
    }
  }

  return errors;
}

// Convenience helper for callers that prefer throwing over collecting errors.
export function assertScenarioShape(scenario: BenchmarkScenario): void {
  const errors = validateScenarioShape(scenario);
  if (errors.length === 0) {
    return;
  }

  throw new Error(`Invalid benchmark scenario "${scenario.name}": ${errors.join(" ")}`);
}

function round(value: number, decimals = 4): number {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

function asNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Reads a slot value with fallback for backward compatibility.
function readSlotKwh(slot: StrategyDecisionSlot, key: keyof StrategyDecisionSlot): number {
  return asNumber(slot[key] as number | undefined);
}

// Calculates a clean metric set directly from a strategy result's slot trace.
// If a trace field is missing, this function falls back to existing aggregate metrics.
export function calculateMetricsFromStrategyResult(result: StrategyResult): StrategyComparisonRow {
  const slots = Array.isArray(result.decisions) ? result.decisions : [];

  const importCostFromTrace = slots.reduce((sum, slot) => {
    return sum + (readSlotKwh(slot, "gridImportKwh") * asNumber(slot.importPricePencePerKwh) / 100);
  }, 0);

  const exportRevenueFromTrace = slots.reduce((sum, slot) => {
    return sum + (readSlotKwh(slot, "gridExportKwh") * asNumber(slot.exportPricePencePerKwh) / 100);
  }, 0);

  const totalImportCost = slots.length > 0 ? importCostFromTrace : result.metrics.totalImportCost;
  const totalExportRevenue = slots.length > 0 ? exportRevenueFromTrace : result.metrics.totalExportRevenue;
  const netEnergyCost = totalImportCost - totalExportRevenue;

  const evEnergyDeliveredKwh = slots.reduce((sum, slot) => sum + readSlotKwh(slot, "evChargeKwh"), 0);
  const evRequiredChargeKwh = asNumber(result.telemetry?.evRequiredChargeKwh);
  const evTargetAchieved =
    evRequiredChargeKwh > 0
      ? evEnergyDeliveredKwh >= evRequiredChargeKwh
      : Boolean(result.metrics.evTargetMet);
  // Penalty logic
  const EV_PENALTY = 500; // £500 penalty for missing EV target
  const evTargetMissPenalty = evTargetAchieved ? 0 : EV_PENALTY;
  const adjustedNetEnergyCost = netEnergyCost + evTargetMissPenalty;

  const batteryChargeKwh = slots.reduce((sum, slot) => sum + readSlotKwh(slot, "batteryChargeKwh"), 0);
  const batteryDischargeKwh = slots.reduce((sum, slot) => sum + readSlotKwh(slot, "batteryDischargeKwh"), 0);
  const batteryThroughputKwh = batteryChargeKwh + batteryDischargeKwh;

  const batteryCapacityKwh = asNumber(result.telemetry?.batteryCapacityKwh);
  const estimatedBatteryCycles =
    batteryCapacityKwh > 0
      ? batteryThroughputKwh / (2 * batteryCapacityKwh)
      : result.metrics.batteryCycles;

  const totalSolarGenerationKwh = slots.reduce((sum, slot) => sum + readSlotKwh(slot, "solarGenerationKwh"), 0);
  // Assumption: grid export in this harness is treated as solar spill/export.
  const solarSpillExportKwh = slots.reduce((sum, slot) => sum + readSlotKwh(slot, "gridExportKwh"), 0);
  const solarSelfConsumption =
    totalSolarGenerationKwh > 0
      ? (totalSolarGenerationKwh - solarSpillExportKwh) / totalSolarGenerationKwh
      : result.metrics.selfConsumptionRatio;

  const negativePriceCaptureKwh = slots.reduce((sum, slot) => {
    if (asNumber(slot.importPricePencePerKwh) < 0) {
      return sum + readSlotKwh(slot, "gridImportKwh");
    }

    return sum;
  }, 0);

  const reserveViolationsCount = slots.reduce((count, slot) => {
    const reserve = slot.batteryReserveKwh;
    const soc = slot.batterySocKwhEnd;
    if (typeof reserve === "number" && typeof soc === "number" && soc < reserve) {
      return count + 1;
    }

    return count;
  }, 0);

  return {
    strategyId: result.strategyId,
    strategyName: result.strategyName,
    totalImportCost: round(totalImportCost),
    totalExportRevenue: round(totalExportRevenue),
    netEnergyCost: round(netEnergyCost),
    evTargetMissPenalty,
    adjustedNetEnergyCost: round(adjustedNetEnergyCost),
    evEnergyDeliveredKwh: round(evEnergyDeliveredKwh),
    evTargetAchieved,
    batteryThroughputKwh: round(batteryThroughputKwh),
    estimatedBatteryCycles:
      typeof estimatedBatteryCycles === "number" ? round(estimatedBatteryCycles) : undefined,
    solarSelfConsumption:
      typeof solarSelfConsumption === "number" ? round(solarSelfConsumption) : undefined,
    solarSpillExportKwh: round(solarSpillExportKwh),
    negativePriceCaptureKwh: round(negativePriceCaptureKwh),
    reserveViolationsCount,
  };
}

// Produces compact side-by-side comparison rows suitable for table printing.
export function buildStrategyComparison(results: StrategyResult[]): StrategyComparisonTable {
  const rows = results.map(calculateMetricsFromStrategyResult);
  // Sort by adjustedNetEnergyCost (penalizes missing EV target)
  const sortedRows = rows.slice().sort((a, b) => a.adjustedNetEnergyCost - b.adjustedNetEnergyCost);
  return {
    rows: sortedRows,
    bestNetEnergyCostStrategyId: sortedRows[0]?.strategyId,
  };
}

// Placeholder metric builder used while strategy logic is still being wired.
// If a strategy already computes values, we pass them through.
// Otherwise we default to zeroes so reporting remains deterministic.
export function buildMetricsFromPartial(
  partial?: Partial<BenchmarkMetrics>
): BenchmarkMetrics {
  const totalImportCost = partial?.totalImportCost ?? 0;
  const totalExportRevenue = partial?.totalExportRevenue ?? 0;

  return {
    totalImportCost,
    totalExportRevenue,
    totalNetCost: partial?.totalNetCost ?? totalImportCost - totalExportRevenue,
    selfConsumptionRatio: partial?.selfConsumptionRatio,
    batteryCycles: partial?.batteryCycles,
    evTargetMet: partial?.evTargetMet,
  };
}

// Simple ranking helper: lower net cost wins.
export function chooseWinnerStrategyId(results: StrategyResult[]): string | undefined {
  if (results.length === 0) {
    return undefined;
  }

  return results
    .slice()
    .sort((a, b) => a.metrics.totalNetCost - b.metrics.totalNetCost)[0]?.strategyId;
}
