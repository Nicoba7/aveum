import type { ContinuousLoopState } from "../continuousLoop/controlLoopRunnerTypes";
import type { IntervalScheduler } from "../continuousLoop/intervalScheduler";
import type { ExecutionJournalStore } from "../../journal/executionJournalStore";
import { runContinuousRuntime } from "./runContinuousRuntime";
import type { OptimizerInput } from "../../domain";
import type { OptimizerOutput } from "../../domain/optimizer";
import { getCanonicalSimulationSnapshot } from "../../simulator";
import type { TeslaSingleRunRuntime, TeslaSingleRunRuntimeConfigSource } from "./teslaSingleRunBootstrap";
import type { RuntimeTariffResolution } from "./resolveRuntimeTariffSchedule";
import {
  createTeslaRuntimeIntegration,
  normalizeTeslaRuntimeError,
  type TeslaRuntimeIntegrationDependencies,
  type TeslaRuntimeIntegrationSource,
} from "../../integrations/tesla/teslaRuntimeIntegration";

export interface TeslaContinuousLiveSource extends TeslaRuntimeIntegrationSource {}

export interface TeslaContinuousLiveRuntimeDependencies {
  integration?: TeslaRuntimeIntegrationDependencies;
  bootstrapFromSource?: (source: TeslaSingleRunRuntimeConfigSource) => TeslaSingleRunRuntime;
  getSnapshot?: (now: Date) => ReturnType<typeof getCanonicalSimulationSnapshot>;
  optimizeInput?: (input: OptimizerInput) => OptimizerOutput;
  resolveTariffSchedule?: (params: {
    now: Date;
    fallbackTariffSchedule: ReturnType<typeof getCanonicalSimulationSnapshot>["tariffSchedule"];
    sourceEnv: TeslaContinuousLiveSource;
  }) => Promise<RuntimeTariffResolution>;
  journalStore?: ExecutionJournalStore;
  scheduler?: IntervalScheduler;
  nowFn?: () => Date;
}

export interface TeslaContinuousLiveRuntimeHandle {
  start(): Promise<void>;
  stop(): void;
  getState(): Readonly<ContinuousLoopState>;
  journalStore: ExecutionJournalStore;
}

export async function createTeslaContinuousLiveRuntime(
  source: TeslaContinuousLiveSource,
  dependencies?: TeslaContinuousLiveRuntimeDependencies,
): Promise<TeslaContinuousLiveRuntimeHandle> {
  const integrationDependencies: TeslaRuntimeIntegrationDependencies = {
    bootstrapFromSource: dependencies?.integration?.bootstrapFromSource ?? dependencies?.bootstrapFromSource,
    getSnapshot: dependencies?.integration?.getSnapshot ?? dependencies?.getSnapshot,
    optimizeInput: dependencies?.integration?.optimizeInput ?? dependencies?.optimizeInput,
    resolveTariffSchedule:
      dependencies?.integration?.resolveTariffSchedule ?? dependencies?.resolveTariffSchedule,
  };

  return runContinuousRuntime({
    source,
    integration: createTeslaRuntimeIntegration(),
    integrationDependencies,
    launcherDependencies: {
      journalStore: dependencies?.journalStore,
      scheduler: dependencies?.scheduler,
      nowFn: dependencies?.nowFn,
    },
  });
}

export async function runTeslaContinuousLiveCli(
  source: TeslaContinuousLiveSource = process.env as TeslaContinuousLiveSource,
): Promise<number> {
  try {
    const runtime = await createTeslaContinuousLiveRuntime(source);

    const stop = () => {
      runtime.stop();
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);

    await runtime.start();

    while (runtime.getState().status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return 0;
  } catch (error) {
    console.error(JSON.stringify({ status: "error", error: normalizeTeslaRuntimeError(error) }, null, 2));
    return 1;
  }
}
