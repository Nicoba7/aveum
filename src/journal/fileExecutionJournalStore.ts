import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CycleHeartbeatEntry, ExecutionJournalEntry } from "./executionJournal";
import type { ExecutionJournalStore } from "./executionJournalStore";

export interface FileExecutionJournalStoreOptions {
  directoryPath: string;
  executionEntriesFileName?: string;
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

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

/**
 * First durable execution journal store implementation backed by local NDJSON files.
 *
 * This keeps the interface synchronous so it can be dropped into existing runtime
 * paths without changing canonical execution service semantics.
 */
export class FileExecutionJournalStore implements ExecutionJournalStore {
  private readonly executionEntriesPath: string;
  private readonly cycleHeartbeatsPath: string;

  constructor(options: FileExecutionJournalStoreOptions) {
    ensureDirectory(options.directoryPath);

    const executionEntriesFileName = options.executionEntriesFileName ?? "execution-journal.ndjson";
    const cycleHeartbeatsFileName = options.cycleHeartbeatsFileName ?? "cycle-heartbeat.ndjson";

    this.executionEntriesPath = join(options.directoryPath, executionEntriesFileName);
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

  appendHeartbeat(entry: CycleHeartbeatEntry): void {
    appendNdjsonLine(this.cycleHeartbeatsPath, entry);
  }

  getCycleHeartbeats(): CycleHeartbeatEntry[] {
    return readNdjson<CycleHeartbeatEntry>(this.cycleHeartbeatsPath);
  }
}
