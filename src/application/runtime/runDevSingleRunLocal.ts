import { DeviceAdapterRegistry } from "../../adapters/adapterRegistry";
import { TeslaChargingRealAdapter } from "../../adapters/tesla/TeslaChargingRealAdapter";
import { FileExecutionJournalStore } from "../../journal/fileExecutionJournalStore";
import { InMemoryExecutionJournalStore } from "../../journal/executionJournalStore";
import { resolveJournalDirectoryPath } from "../../journal/journalDirectory";
import { InMemoryObservedDeviceStateStore } from "../../observed/observedDeviceStateStore";
import { LiveAdapterDeviceCommandExecutor } from "../controlLoopExecution/liveAdapterExecutor";
import { runSingleTeslaCycle } from "./runSingleTeslaCycle";
import {
  runTeslaSingleRunLocal,
  type TeslaLocalSingleRunDependencies,
  type TeslaLocalSingleRunSource,
  type TeslaLocalSingleRunSummary,
} from "./runTeslaSingleRunLocal";

export interface DevLocalSingleRunSource {
  GRIDLY_NOW_ISO?: string;
  GRIDLY_SITE_ID?: string;
  GRIDLY_TIMEZONE?: string;
  GRIDLY_PLANNING_STYLE?: string;
  GRIDLY_OPTIMIZATION_MODE?: string;
  GRIDLY_CONFIG_DIR?: string;
  GRIDLY_JOURNAL_DIR?: string;
  GRIDLY_DEV_VEHICLE_ID?: string;
}

const DEFAULT_DEV_ACCESS_TOKEN = "gridly-dev-token";
const DEFAULT_DEV_VEHICLE_ID = "gridly-dev-vehicle-1";
const DEFAULT_SCENARIO_DAY = "2026-03-16";

function buildCandidateNowIsos(): string[] {
  const candidates: string[] = [];

  for (let slot = 0; slot < 48; slot += 1) {
    const hour = Math.floor(slot / 2).toString().padStart(2, "0");
    const minute = slot % 2 === 0 ? "00" : "30";
    candidates.push(`${DEFAULT_SCENARIO_DAY}T${hour}:${minute}:00.000Z`);
  }

  return candidates;
}

function toTeslaLocalSource(
  source: DevLocalSingleRunSource,
  nowIso: string,
  vehicleId: string,
): TeslaLocalSingleRunSource {
  return {
    GRIDLY_NOW_ISO: nowIso,
    GRIDLY_SITE_ID: source.GRIDLY_SITE_ID,
    GRIDLY_TIMEZONE: source.GRIDLY_TIMEZONE,
    GRIDLY_PLANNING_STYLE: source.GRIDLY_PLANNING_STYLE,
    GRIDLY_OPTIMIZATION_MODE: source.GRIDLY_OPTIMIZATION_MODE,
    GRIDLY_CONFIG_DIR: source.GRIDLY_CONFIG_DIR,
    GRIDLY_JOURNAL_DIR: source.GRIDLY_JOURNAL_DIR,
    TESLA_ACCESS_TOKEN: DEFAULT_DEV_ACCESS_TOKEN,
    TESLA_VEHICLE_ID: vehicleId,
  };
}

function buildDevRuntimeDependencies(): TeslaLocalSingleRunDependencies {
  return {
    bootstrapFromSource: (source) => {
      const vehicleId = source.TESLA_VEHICLE_ID?.trim() || DEFAULT_DEV_VEHICLE_ID;
      const teslaAdapter = new TeslaChargingRealAdapter({
        supportedVehicleIds: [vehicleId],
        client: {
          startCharging: async () => ({ result: true, reason: "ok" }),
          stopCharging: async () => ({ result: true, reason: "ok" }),
          readChargingTelemetry: async () => ({
            vehicleId,
            timestamp: new Date().toISOString(),
            chargingState: "Stopped",
            chargePortLatch: "Engaged",
            chargerPowerKw: 0,
            batteryLevel: 38,
          }),
        },
      });
      const registry = new DeviceAdapterRegistry([teslaAdapter]);
      const executor = new LiveAdapterDeviceCommandExecutor(registry);
      const observedStateStore = new InMemoryObservedDeviceStateStore();

      return {
        config: {
          accessToken: DEFAULT_DEV_ACCESS_TOKEN,
          vehicleId,
          timeoutMs: 1_000,
        },
        teslaAdapter,
        observedStateStore,
        executor,
        async runCycle(input) {
          return runSingleTeslaCycle({
            ...input,
            teslaVehicleId: vehicleId,
            teslaAdapter,
            observedStateStore,
            executor,
          });
        },
      };
    },
    resolveTariffSchedule: async ({ fallbackTariffSchedule }) => ({
      tariffSchedule: fallbackTariffSchedule,
      source: "simulated",
      caveats: ["Using stubbed local runtime inputs for product iteration."],
    }),
  };
}

async function resolveScenarioNowIso(
  source: DevLocalSingleRunSource,
  vehicleId: string,
  dependencies: TeslaLocalSingleRunDependencies,
): Promise<string> {
  if (source.GRIDLY_NOW_ISO?.trim()) {
    return source.GRIDLY_NOW_ISO.trim();
  }

  for (const nowIso of buildCandidateNowIsos()) {
    const journalStore = new InMemoryExecutionJournalStore();
    const summary = await runTeslaSingleRunLocal(
      toTeslaLocalSource(source, nowIso, vehicleId),
      {
        ...dependencies,
        journalStoreFactory: () => journalStore,
      },
    );

    if (summary.status === "ok" && journalStore.getDecisionExplanations().length > 0) {
      return nowIso;
    }
  }

  throw new Error("Unable to find a stubbed runtime scenario that produces decision explanations.");
}

export async function runDevSingleRunLocal(
  source: DevLocalSingleRunSource = process.env,
): Promise<TeslaLocalSingleRunSummary> {
  const vehicleId = source.GRIDLY_DEV_VEHICLE_ID?.trim() || DEFAULT_DEV_VEHICLE_ID;
  const dependencies = buildDevRuntimeDependencies();
  const nowIso = await resolveScenarioNowIso(source, vehicleId, dependencies);

  return runTeslaSingleRunLocal(
    toTeslaLocalSource(source, nowIso, vehicleId),
    {
      ...dependencies,
      journalStoreFactory: (resolvedSource) => new FileExecutionJournalStore({
        directoryPath: resolveJournalDirectoryPath(resolvedSource),
      }),
    },
  );
}

export async function runDevSingleRunLocalCli(
  source: DevLocalSingleRunSource = process.env,
): Promise<number> {
  const summary = await runDevSingleRunLocal(source);

  if (summary.status === "ok") {
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  console.error(JSON.stringify(summary, null, 2));
  return 1;
}