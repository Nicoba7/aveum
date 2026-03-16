import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileExecutionJournalStore } from "../journal/fileExecutionJournalStore";
import type { ExecutionJournalEntry, CycleHeartbeatEntry } from "../journal/executionJournal";

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("FileExecutionJournalStore", () => {
  it("persists execution entries and cycle heartbeats across instances", () => {
    const dir = createTempDir("gridly-journal-");

    try {
      const store = new FileExecutionJournalStore({ directoryPath: dir });

      const entry: ExecutionJournalEntry = {
        entryId: "entry-1",
        recordedAt: "2026-03-16T10:05:00.000Z",
        executionRequestId: "req-1",
        idempotencyKey: "key-1",
        targetDeviceId: "battery",
        canonicalCommand: {
          commandId: "cmd-1",
          targetDeviceId: "battery",
          kind: "set_mode",
          mode: "charge",
          effectiveWindow: {
            startAt: "2026-03-16T10:00:00.000Z",
            endAt: "2026-03-16T10:30:00.000Z",
          },
        },
        status: "issued",
        stage: "dispatch",
        schemaVersion: "execution-journal.v1",
      };

      const heartbeat: CycleHeartbeatEntry = {
        entryKind: "cycle_heartbeat",
        cycleId: "cycle-site-1-20260316T100500Z",
        recordedAt: "2026-03-16T10:05:00.000Z",
        executionPosture: "normal",
        commandsIssued: 1,
        commandsSkipped: 0,
        commandsFailed: 0,
        commandsSuppressed: 0,
        failClosedTriggered: false,
        economicSnapshot: {
          optimizationMode: "cost",
          hasValueSeekingDecisions: true,
          valueSeekingExecutionDeferred: false,
          estimatedSavingsVsBaselinePence: 12,
        },
        schemaVersion: "cycle-heartbeat.v1",
      };

      store.append(entry);
      store.appendHeartbeat(heartbeat);

      const reloaded = new FileExecutionJournalStore({ directoryPath: dir });
      expect(reloaded.getAll()).toHaveLength(1);
      expect(reloaded.getAll()[0].entryId).toBe("entry-1");
      expect(reloaded.getCycleHeartbeats()).toHaveLength(1);
      expect(reloaded.getCycleHeartbeats()[0].cycleId).toBe("cycle-site-1-20260316T100500Z");
      expect(reloaded.getCycleHeartbeats()[0].economicSnapshot?.estimatedSavingsVsBaselinePence).toBe(12);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
