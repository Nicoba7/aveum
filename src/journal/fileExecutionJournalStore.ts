import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CycleHeartbeatEntry,
  DecisionExplainedJournalEntry,
  ExecutionJournalEntry,
} from "./executionJournal";
import type { ExecutionJournalStore } from "./executionJournalStore";

export interface FileExecutionJournalStoreOptions {
  directoryPath: string;
  executionEntriesFileName?: string;
  decisionExplanationsFileName?: string;
  cycleHeartbeatsFileName?: string;
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function appendNdjsonLine(path: string, payload: unknown): void {
  appendFileSync(path, `${JSON.stringify(payload)}\n`, { encoding: "utf-8" });
}

function readNdjson<T>(path: string): T[] {
  if (!existsSync(path)) {
    return [];
  }

  const raw = readFileSync(path, "utf-8");
  if (!raw.trim()) {
    return [];
  }

  const entries: T[] = [];

  raw
    .split("\n")
    .forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return;
      }

      try {
        entries.push(JSON.parse(trimmed) as T);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[FileExecutionJournalStore] Skipping malformed NDJSON line ${lineIndex + 1} in ${path}: ${message}`,
        );
      }
    });

  return entries;
}

/**
 * First durable execution journal store implementation backed by local NDJSON files.
 *
 * This keeps the interface synchronous so it can be dropped into existing runtime
 * paths without changing canonical execution service semantics.
 */
export class FileExecutionJournalStore implements ExecutionJournalStore {
  private readonly executionEntriesPath: string;
  private readonly decisionExplanationsPath: string;
  private readonly cycleHeartbeatsPath: string;

  constructor(options: FileExecutionJournalStoreOptions) {
    ensureDirectory(options.directoryPath);

    const executionEntriesFileName = options.executionEntriesFileName ?? "execution-journal.ndjson";
    const decisionExplanationsFileName = options.decisionExplanationsFileName ?? "decision-explained.ndjson";
    const cycleHeartbeatsFileName = options.cycleHeartbeatsFileName ?? "cycle-heartbeat.ndjson";

    this.executionEntriesPath = join(options.directoryPath, executionEntriesFileName);
    this.decisionExplanationsPath = join(options.directoryPath, decisionExplanationsFileName);
    this.cycleHeartbeatsPath = join(options.directoryPath, cycleHeartbeatsFileName);
  }

  append(entry: ExecutionJournalEntry): void {
    appendNdjsonLine(this.executionEntriesPath, entry);
  }

  getAll(): ExecutionJournalEntry[] {
    return readNdjson<ExecutionJournalEntry>(this.executionEntriesPath);
  }

  getByDeviceId(deviceId: string): ExecutionJournalEntry[] {
    return this.getAll().filter((entry) => entry.targetDeviceId === deviceId);
  }

  getByDecisionId(decisionId: string): ExecutionJournalEntry[] {
    return this.getAll().filter((entry) => entry.decisionId === decisionId);
  }

  appendDecisionExplanation(entry: DecisionExplainedJournalEntry): void {
    appendNdjsonLine(this.decisionExplanationsPath, entry);
  }

  getDecisionExplanations(): DecisionExplainedJournalEntry[] {
    return readNdjson<DecisionExplainedJournalEntry>(this.decisionExplanationsPath);
  }

  appendHeartbeat(entry: CycleHeartbeatEntry): void {
    appendNdjsonLine(this.cycleHeartbeatsPath, entry);
  }

  getCycleHeartbeats(): CycleHeartbeatEntry[] {
    return readNdjson<CycleHeartbeatEntry>(this.cycleHeartbeatsPath);
  }
}
