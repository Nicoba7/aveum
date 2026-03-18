import { DeviceAdapterRegistry } from "../../adapters/adapterRegistry";
import { TeslaHttpApiClient } from "../../adapters/tesla/TeslaApiClient";
import { TeslaChargingRealAdapter } from "../../adapters/tesla/TeslaChargingRealAdapter";
import { InMemoryObservedDeviceStateStore, type ObservedDeviceStateStore } from "../../observed/observedDeviceStateStore";
import { LiveAdapterDeviceCommandExecutor, type DeviceCommandExecutor } from "../controlLoopExecution/liveAdapterExecutor";
import { runSingleTeslaCycle, type RunSingleTeslaCycleInput, type RunSingleTeslaCycleResult } from "./runSingleTeslaCycle";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TeslaSingleRunRuntimeConfig {
  accessToken: string;
  vehicleId: string;
  baseUrl?: string;
  timeoutMs: number;
}

export interface TeslaSingleRunRuntimeConfigSource {
  TESLA_ACCESS_TOKEN?: string;
  TESLA_VEHICLE_ID?: string;
  TESLA_BASE_URL?: string;
  TESLA_TIMEOUT_MS?: string;
}

export type TeslaSingleRunBootstrapErrorCode =
  | "MISSING_ACCESS_TOKEN"
  | "MISSING_VEHICLE_ID"
  | "INVALID_BASE_URL"
  | "INVALID_TIMEOUT_MS";

export class TeslaSingleRunBootstrapError extends Error {
  constructor(
    public readonly code: TeslaSingleRunBootstrapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeslaSingleRunBootstrapError";
  }
}

export interface TeslaSingleRunRuntime {
  config: TeslaSingleRunRuntimeConfig;
  teslaAdapter: TeslaChargingRealAdapter;
  observedStateStore: ObservedDeviceStateStore;
  executor: DeviceCommandExecutor;
  runCycle(
    input: Omit<RunSingleTeslaCycleInput, "teslaVehicleId" | "teslaAdapter" | "observedStateStore" | "executor">,
  ): Promise<RunSingleTeslaCycleResult>;
}

export interface BootstrapTeslaSingleRunRuntimeOptions {
  fetchFn?: FetchLike;
  observedStateStore?: ObservedDeviceStateStore;
}

function parseTimeout(timeoutRaw: string | undefined): number {
  if (!timeoutRaw || timeoutRaw.trim() === "") {
    return 10_000;
  }

  const parsed = Number(timeoutRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TeslaSingleRunBootstrapError(
      "INVALID_TIMEOUT_MS",
      "TESLA_TIMEOUT_MS must be a positive number.",
    );
  }

  return parsed;
}

export function parseTeslaSingleRunRuntimeConfig(
  source: TeslaSingleRunRuntimeConfigSource,
): TeslaSingleRunRuntimeConfig {
  const accessToken = source.TESLA_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new TeslaSingleRunBootstrapError(
      "MISSING_ACCESS_TOKEN",
      "TESLA_ACCESS_TOKEN is required.",
    );
  }

  const vehicleId = source.TESLA_VEHICLE_ID?.trim();
  if (!vehicleId) {
    throw new TeslaSingleRunBootstrapError(
      "MISSING_VEHICLE_ID",
      "TESLA_VEHICLE_ID is required.",
    );
  }

  const baseUrl = source.TESLA_BASE_URL?.trim();
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new TeslaSingleRunBootstrapError(
        "INVALID_BASE_URL",
        "TESLA_BASE_URL must be a valid URL.",
      );
    }
  }

  return {
    accessToken,
    vehicleId,
    baseUrl,
    timeoutMs: parseTimeout(source.TESLA_TIMEOUT_MS),
  };
}

export function bootstrapTeslaSingleRunRuntime(
  config: TeslaSingleRunRuntimeConfig,
  options?: BootstrapTeslaSingleRunRuntimeOptions,
): TeslaSingleRunRuntime {
  const teslaClient = new TeslaHttpApiClient({
    accessToken: config.accessToken,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    fetchFn: options?.fetchFn,
  });

  const teslaAdapter = new TeslaChargingRealAdapter({
    supportedVehicleIds: [config.vehicleId],
    client: teslaClient,
  });

  const registry = new DeviceAdapterRegistry([teslaAdapter]);
  const executor = new LiveAdapterDeviceCommandExecutor(registry);
  const observedStateStore = options?.observedStateStore ?? new InMemoryObservedDeviceStateStore();

  return {
    config,
    teslaAdapter,
    observedStateStore,
    executor,
    async runCycle(input) {
      return runSingleTeslaCycle({
        ...input,
        teslaVehicleId: config.vehicleId,
        teslaAdapter,
        observedStateStore,
        executor,
      });
    },
  };
}

export function bootstrapTeslaSingleRunRuntimeFromSource(
  source: TeslaSingleRunRuntimeConfigSource,
  options?: BootstrapTeslaSingleRunRuntimeOptions,
): TeslaSingleRunRuntime {
  const config = parseTeslaSingleRunRuntimeConfig(source);
  return bootstrapTeslaSingleRunRuntime(config, options);
}
