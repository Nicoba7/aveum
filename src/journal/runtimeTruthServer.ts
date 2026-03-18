import { FileExecutionJournalStore } from "./fileExecutionJournalStore";
import {
  buildRuntimeTruthSnapshot,
  type RuntimeTruthApiResponse,
  type RuntimeTruthSnapshot,
} from "./runtimeTruthSnapshot";
import { resolveJournalDirectoryPath } from "./journalDirectory";

export interface RuntimeTruthServerOptions {
  journalDirectoryPath?: string;
  fetchedAt?: string;
}

export interface RuntimeTruthSourceEnvironment {
  GRIDLY_JOURNAL_DIR?: string;
}

export function resolveRuntimeTruthJournalDirectory(
  source: RuntimeTruthSourceEnvironment = process.env as RuntimeTruthSourceEnvironment,
  options?: { cwd?: string },
): string {
  return resolveJournalDirectoryPath(source, options);
}

export function readDurableRuntimeTruthSnapshot(
  options?: RuntimeTruthServerOptions,
): RuntimeTruthSnapshot {
  const directoryPath = options?.journalDirectoryPath?.trim() || resolveRuntimeTruthJournalDirectory();
  const store = new FileExecutionJournalStore({ directoryPath });

  return buildRuntimeTruthSnapshot({
    cycleHeartbeats: store.getCycleHeartbeats(),
    executionOutcomes: store.getAll(),
    decisionExplanations: store.getDecisionExplanations(),
  });
}

export function buildRuntimeTruthApiResponse(
  options?: RuntimeTruthServerOptions,
): RuntimeTruthApiResponse {
  return {
    ...readDurableRuntimeTruthSnapshot(options),
    source: "durable_journal",
    fetchedAt: options?.fetchedAt ?? new Date().toISOString(),
  };
}