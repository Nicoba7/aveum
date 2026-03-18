import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DeviceState, Constraints } from "../../domain";
import {
  DEFAULT_PLANNING_STYLE,
  formatPlanningStyleLabel,
  getPlanningStylePolicyProfile,
  mapOptimizationModeToPlanningStyle,
  resolvePlanningStyleFromValue,
  type PlanningStyle,
  type PlanningStylePolicyProfile,
} from "../../domain";

export interface PlanningStyleSourceEnvironment {
  GRIDLY_PLANNING_STYLE?: string;
  GRIDLY_OPTIMIZATION_MODE?: string;
  GRIDLY_CONFIG_DIR?: string;
}

export interface PersistedPlanningStyleRecord {
  planningStyle: PlanningStyle;
  updatedAt: string;
}

export interface ResolvedPlanningStyle {
  activeStyle: PlanningStyle;
  profile: PlanningStylePolicyProfile;
  source: "env" | "legacy_mode" | "file" | "default";
  requestedValue?: string;
  defaulted: boolean;
}

function resolveConfigDirectoryPath(
  source: PlanningStyleSourceEnvironment = process.env as PlanningStyleSourceEnvironment,
  options?: { cwd?: string },
): string {
  const cwd = options?.cwd ?? process.cwd();
  const configured = source.GRIDLY_CONFIG_DIR?.trim();
  return configured ? resolve(cwd, configured) : resolve(cwd, ".gridly/config");
}

export function resolvePlanningStyleFilePath(
  source: PlanningStyleSourceEnvironment = process.env as PlanningStyleSourceEnvironment,
  options?: { cwd?: string },
): string {
  return join(resolveConfigDirectoryPath(source, options), "planning-style.json");
}

export function readPersistedPlanningStyle(
  source: PlanningStyleSourceEnvironment = process.env as PlanningStyleSourceEnvironment,
  options?: { cwd?: string },
): PersistedPlanningStyleRecord | undefined {
  const filePath = resolvePlanningStyleFilePath(source, options);
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as Partial<PersistedPlanningStyleRecord>;
    const planningStyle = resolvePlanningStyleFromValue(parsed.planningStyle);
    if (!planningStyle) {
      return undefined;
    }

    return {
      planningStyle,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

export function writePersistedPlanningStyle(
  planningStyle: PlanningStyle,
  source: PlanningStyleSourceEnvironment = process.env as PlanningStyleSourceEnvironment,
  options?: { cwd?: string },
): PersistedPlanningStyleRecord {
  const record: PersistedPlanningStyleRecord = {
    planningStyle,
    updatedAt: new Date().toISOString(),
  };
  const filePath = resolvePlanningStyleFilePath(source, options);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
  return record;
}

export function resolvePlanningStyle(
  source: PlanningStyleSourceEnvironment = process.env as PlanningStyleSourceEnvironment,
  options?: { cwd?: string },
): ResolvedPlanningStyle {
  const requestedPlanningStyle = source.GRIDLY_PLANNING_STYLE?.trim();
  const styleFromPlanningStyle = resolvePlanningStyleFromValue(requestedPlanningStyle);
  if (styleFromPlanningStyle) {
    return {
      activeStyle: styleFromPlanningStyle,
      profile: getPlanningStylePolicyProfile(styleFromPlanningStyle),
      source: "env",
      requestedValue: requestedPlanningStyle,
      defaulted: false,
    };
  }

  const requestedOptimizationMode = source.GRIDLY_OPTIMIZATION_MODE?.trim();
  const styleFromOptimizationMode = mapOptimizationModeToPlanningStyle(requestedOptimizationMode);
  if (styleFromOptimizationMode) {
    return {
      activeStyle: styleFromOptimizationMode,
      profile: getPlanningStylePolicyProfile(styleFromOptimizationMode),
      source: "legacy_mode",
      requestedValue: requestedOptimizationMode,
      defaulted: false,
    };
  }

  const persisted = readPersistedPlanningStyle(source, options);
  if (persisted) {
    return {
      activeStyle: persisted.planningStyle,
      profile: getPlanningStylePolicyProfile(persisted.planningStyle),
      source: "file",
      requestedValue: persisted.planningStyle,
      defaulted: false,
    };
  }

  return {
    activeStyle: DEFAULT_PLANNING_STYLE,
    profile: getPlanningStylePolicyProfile(DEFAULT_PLANNING_STYLE),
    source: "default",
    defaulted: true,
  };
}

export function buildConstraintsForPlanningStyle(
  devices: DeviceState[],
  resolvedStyle: ResolvedPlanningStyle,
): Constraints {
  const hasBattery = devices.some((device) => device.kind === "battery");
  const hasGrid = devices.some((device) => device.kind === "smart_meter");
  const hasEv = devices.some((device) => device.kind === "ev_charger");
  const runtimeInputs = resolvedStyle.profile.runtimeInputs;

  return {
    mode: resolvedStyle.profile.optimizationMode,
    planningStyle: resolvedStyle.activeStyle,
    batteryReservePercent: runtimeInputs.batteryReservePercent,
    maxBatteryCyclesPerDay: runtimeInputs.maxBatteryCyclesPerDay,
    batteryDegradationCostPencePerKwh: runtimeInputs.batteryDegradationCostPencePerKwh,
    importAvoidanceWeight: runtimeInputs.importAvoidanceWeight,
    exportPreferenceWeight: runtimeInputs.exportPreferenceWeight,
    selfConsumptionPreferenceWeight: runtimeInputs.selfConsumptionPreferenceWeight,
    evChargeUrgencyWeight: runtimeInputs.evChargeUrgencyWeight,
    evDeadlineUrgencyHours: runtimeInputs.evDeadlineUrgencyHours,
    allowGridBatteryCharging: hasBattery && hasGrid,
    allowBatteryExport: hasBattery && hasGrid,
    allowAutomaticEvCharging: hasEv,
    evReadyBy: "07:00",
    evTargetSocPercent: 85,
  };
}

export function buildPlanningStyleApiResponse(resolvedStyle: ResolvedPlanningStyle): {
  planningStyle: PlanningStyle;
  label: string;
  source: ResolvedPlanningStyle["source"];
  defaulted: boolean;
} {
  return {
    planningStyle: resolvedStyle.activeStyle,
    label: formatPlanningStyleLabel(resolvedStyle.activeStyle),
    source: resolvedStyle.source,
    defaulted: resolvedStyle.defaulted,
  };
}

export { resolvePlanningStyleFromValue };