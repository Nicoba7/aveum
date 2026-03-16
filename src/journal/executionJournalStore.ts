import type { CycleHeartbeatEntry, ExecutionJournalEntry } from "./executionJournal";

export interface ExecutionJournalStore {
  append(entry: ExecutionJournalEntry): void;
  getAll(): ExecutionJournalEntry[];
  getByDeviceId(deviceId: string): ExecutionJournalEntry[];
  getByDecisionId(decisionId: string): ExecutionJournalEntry[];
  appendHeartbeat(entry: CycleHeartbeatEntry): void;
  getCycleHeartbeats(): CycleHeartbeatEntry[];
}

export class InMemoryExecutionJournalStore implements ExecutionJournalStore {
  private readonly entries: ExecutionJournalEntry[] = [];
  private readonly heartbeats: CycleHeartbeatEntry[] = [];

  append(entry: ExecutionJournalEntry): void {
    this.entries.push({ ...entry });
  }

  getAll(): ExecutionJournalEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  getByDeviceId(deviceId: string): ExecutionJournalEntry[] {
    return this.entries
      .filter((entry) => entry.targetDeviceId === deviceId)
      .map((entry) => ({ ...entry }));
  }

  getByDecisionId(decisionId: string): ExecutionJournalEntry[] {
    return this.entries
      .filter((entry) => entry.decisionId === decisionId)
      .map((entry) => ({ ...entry }));
  }

  appendHeartbeat(entry: CycleHeartbeatEntry): void {
    this.heartbeats.push({ ...entry });
  }

  getCycleHeartbeats(): CycleHeartbeatEntry[] {
    return this.heartbeats.map((entry) => ({ ...entry }));
  }
}
