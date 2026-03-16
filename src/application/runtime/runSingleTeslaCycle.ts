import type { ControlLoopDeviceTelemetry, ControlLoopResult } from "../../controlLoop/controlLoop";
import type { DeviceState } from "../../domain";
import type { OptimizerOutput } from "../../domain/optimizer";
import type { DeviceCapabilitiesProvider } from "../../capabilities/deviceCapabilitiesProvider";
import type { ExecutionJournalStore } from "../../journal/executionJournalStore";
import type { ExecutionCycleFinancialContext } from "../../journal/executionJournal";
import type { DeviceShadowStore } from "../../shadow/deviceShadowStore";
import type { CommandExecutionResult, DeviceCommandExecutor } from "../controlLoopExecution/types";
import { runControlLoopExecutionService } from "../controlLoopExecution/service";
import { buildControlLoopInputFromObservedState } from "../telemetry/buildControlLoopInputFromObservedState";
import { ingestCanonicalTelemetry, type TelemetryIngestionResult } from "../telemetry/ingestionService";
import type { ObservedDeviceStateStore } from "../../observed/observedDeviceStateStore";
import type { TeslaChargingRealAdapter } from "../../adapters/tesla/TeslaChargingRealAdapter";

export interface ExecutionResultSummary {
  total: number;
  issued: number;
  skipped: number;
  failed: number;
}

export interface RunSingleTeslaCycleInput {
  now: string;
  siteId: string;
  timezone: string;
  devices: DeviceState[];
  optimizerOutput: OptimizerOutput;
  teslaVehicleId: string;
  teslaAdapter: TeslaChargingRealAdapter;
  observedStateStore: ObservedDeviceStateStore;
  executor: DeviceCommandExecutor;
  capabilitiesProvider?: DeviceCapabilitiesProvider;
  shadowStore?: DeviceShadowStore;
  journalStore?: ExecutionJournalStore;
  cycleFinancialContext?: Omit<ExecutionCycleFinancialContext, "decisionsTaken">;
  deviceTelemetry?: Record<string, ControlLoopDeviceTelemetry>;
  freshnessMaxAgeSeconds?: number;
}

export interface RunSingleTeslaCycleResult {
  telemetryIngestionResult: TelemetryIngestionResult;
  controlLoopResult: ControlLoopResult;
  executionResults: CommandExecutionResult[];
  executionSummary: ExecutionResultSummary;
}

function summarizeExecutionResults(results: CommandExecutionResult[]): ExecutionResultSummary {
  return {
    total: results.length,
    issued: results.filter((result) => result.status === "issued").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}

/**
 * Single-run runtime seam for one Tesla-backed observe -> decide -> act cycle.
 */
export async function runSingleTeslaCycle(
  input: RunSingleTeslaCycleInput,
): Promise<RunSingleTeslaCycleResult> {
  const vendorTelemetry = await input.teslaAdapter.readVendorChargingTelemetry(input.teslaVehicleId);
  const canonicalTelemetry = input.teslaAdapter.mapVendorTelemetryToCanonicalTelemetry(vendorTelemetry);

  const telemetryIngestionResult = ingestCanonicalTelemetry(
    canonicalTelemetry,
    input.observedStateStore,
  );

  const controlLoopInput = buildControlLoopInputFromObservedState({
    now: input.now,
    siteId: input.siteId,
    timezone: input.timezone,
    devices: input.devices,
    optimizerOutput: input.optimizerOutput,
    observedStateStore: input.observedStateStore,
    deviceTelemetry: input.deviceTelemetry,
    freshnessMaxAgeSeconds: input.freshnessMaxAgeSeconds,
    recentTelemetryIngestionOutcomes: telemetryIngestionResult.outcomes,
  });

  const execution = await runControlLoopExecutionService(
    controlLoopInput,
    input.executor,
    input.capabilitiesProvider,
    input.shadowStore,
    input.journalStore,
    input.cycleFinancialContext,
  );

  return {
    telemetryIngestionResult,
    controlLoopResult: execution.controlLoopResult,
    executionResults: execution.executionResults,
    executionSummary: summarizeExecutionResults(execution.executionResults),
  };
}
