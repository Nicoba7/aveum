import type { OptimizationMode } from "./optimizer.js";

export type PlanningStyle = "cheapest" | "balanced" | "greenest";

export interface PlanningStyleRuntimeInputs {
  batteryReservePercent: number;
  maxBatteryCyclesPerDay: number;
  batteryDegradationCostPencePerKwh: number;
  importAvoidanceWeight: number;
  exportPreferenceWeight: number;
  selfConsumptionPreferenceWeight: number;
  evChargeUrgencyWeight: number;
  evDeadlineUrgencyHours: number;
}

export interface PlanningStylePolicyProfile {
  style: PlanningStyle;
  optimizationMode: OptimizationMode;
  runtimeInputs: PlanningStyleRuntimeInputs;
}

export const DEFAULT_PLANNING_STYLE: PlanningStyle = "balanced";

const PLANNING_STYLE_PROFILES: Record<PlanningStyle, PlanningStylePolicyProfile> = {
  cheapest: {
    style: "cheapest",
    optimizationMode: "cost",
    runtimeInputs: {
      batteryReservePercent: 22,
      maxBatteryCyclesPerDay: 3,
      batteryDegradationCostPencePerKwh: 1,
      importAvoidanceWeight: 1.08,
      exportPreferenceWeight: 1.22,
      selfConsumptionPreferenceWeight: 0.88,
      evChargeUrgencyWeight: 1.18,
      evDeadlineUrgencyHours: 5,
    },
  },
  balanced: {
    style: "balanced",
    optimizationMode: "balanced",
    runtimeInputs: {
      batteryReservePercent: 30,
      maxBatteryCyclesPerDay: 2,
      batteryDegradationCostPencePerKwh: 2,
      importAvoidanceWeight: 1,
      exportPreferenceWeight: 1,
      selfConsumptionPreferenceWeight: 1,
      evChargeUrgencyWeight: 1,
      evDeadlineUrgencyHours: 3,
    },
  },
  greenest: {
    style: "greenest",
    optimizationMode: "carbon",
    runtimeInputs: {
      batteryReservePercent: 38,
      maxBatteryCyclesPerDay: 1,
      batteryDegradationCostPencePerKwh: 3,
      importAvoidanceWeight: 0.94,
      exportPreferenceWeight: 0.72,
      selfConsumptionPreferenceWeight: 1.35,
      evChargeUrgencyWeight: 0.82,
      evDeadlineUrgencyHours: 2,
    },
  },
};

export function isPlanningStyle(value: string | undefined): value is PlanningStyle {
  return value === "cheapest" || value === "balanced" || value === "greenest";
}

export function resolvePlanningStyleFromValue(value: string | undefined): PlanningStyle | undefined {
  const normalized = value?.trim().toLowerCase();
  return isPlanningStyle(normalized) ? normalized : undefined;
}

export function mapOptimizationModeToPlanningStyle(value: string | undefined): PlanningStyle | undefined {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "cost") {
    return "cheapest";
  }

  if (normalized === "balanced") {
    return "balanced";
  }

  if (normalized === "carbon" || normalized === "self_consumption") {
    return "greenest";
  }

  return undefined;
}

export function getPlanningStylePolicyProfile(style: PlanningStyle): PlanningStylePolicyProfile {
  return PLANNING_STYLE_PROFILES[style];
}

export function formatPlanningStyleLabel(style: PlanningStyle): string {
  if (style === "cheapest") return "Cheapest";
  if (style === "greenest") return "Greenest";
  return "Balanced";
}