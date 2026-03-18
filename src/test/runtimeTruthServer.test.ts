import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FileExecutionJournalStore } from "../journal/fileExecutionJournalStore";
import { buildRuntimeTruthApiResponse } from "../journal/runtimeTruthServer";

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("runtime truth server bridge", () => {
  it("reads the latest persisted canonical heartbeat and recent outcomes from durable journal state", () => {
    const directoryPath = createTempDir("gridly-runtime-truth-");

    try {
      const store = new FileExecutionJournalStore({ directoryPath });

      store.appendHeartbeat({
        entryKind: "cycle_heartbeat",
        cycleId: "cycle-old",
        recordedAt: "2026-03-16T10:00:00.000Z",
        executionPosture: "normal",
        commandsIssued: 0,
        commandsSkipped: 0,
        commandsFailed: 0,
        commandsSuppressed: 0,
        failClosedTriggered: false,
        nextCycleExecutionCaution: "normal",
        schemaVersion: "cycle-heartbeat.v1",
      });
      store.appendHeartbeat({
        entryKind: "cycle_heartbeat",
        cycleId: "cycle-new",
        recordedAt: "2026-03-16T10:30:00.000Z",
        executionPosture: "hold_only",
        commandsIssued: 0,
        commandsSkipped: 1,
        commandsFailed: 0,
        commandsSuppressed: 1,
        failClosedTriggered: false,
        nextCycleExecutionCaution: "caution",
        schemaVersion: "cycle-heartbeat.v1",
      });

      store.append({
        entryId: "entry-old",
        cycleId: "cycle-old",
        recordedAt: "2026-03-16T10:00:00.000Z",
        executionRequestId: "request-old",
        idempotencyKey: "key-old",
        targetDeviceId: "battery",
        canonicalCommand: {
          commandId: "cmd-old",
          targetDeviceId: "battery",
          kind: "set_mode",
          mode: "charge",
          effectiveWindow: {
            startAt: "2026-03-16T10:00:00.000Z",
            endAt: "2026-03-16T10:30:00.000Z",
          },
        },
        status: "issued",
        schemaVersion: "execution-journal.v1",
      });
      store.append({
        entryId: "entry-new",
        cycleId: "cycle-new",
        recordedAt: "2026-03-16T10:30:00.000Z",
        executionRequestId: "request-new",
        idempotencyKey: "key-new",
        targetDeviceId: "ev",
        canonicalCommand: {
          commandId: "cmd-new",
          targetDeviceId: "ev",
          kind: "set_mode",
          mode: "charge",
          effectiveWindow: {
            startAt: "2026-03-16T10:30:00.000Z",
            endAt: "2026-03-16T11:00:00.000Z",
          },
        },
        status: "skipped",
        schemaVersion: "execution-journal.v1",
      });
      store.appendDecisionExplanation({
        type: "decision.explained",
        timestamp: "2026-03-16T10:30:00.000Z",
        cycleId: "cycle-new",
        opportunityId: "opp-new",
        decision: "selected_opportunity",
        targetDeviceId: "ev",
        explanation: {
          summary: "Decision selected_opportunity for opportunity opp-new: Selected as executable.",
          drivers: ["Decision outcome: selected_opportunity.", "Opportunity: opp-new."],
          confidence: "medium",
          confidence_reason: "Planning confidence signal: medium.",
          caution: null,
        },
        schemaVersion: "decision-explained.v1",
      });

      const snapshot = buildRuntimeTruthApiResponse({
        journalDirectoryPath: directoryPath,
        fetchedAt: "2026-03-16T10:35:00.000Z",
      });

      expect(snapshot.source).toBe("durable_journal");
      expect(snapshot.fetchedAt).toBe("2026-03-16T10:35:00.000Z");
      expect(snapshot.latestCycleHeartbeat?.cycleId).toBe("cycle-new");
      expect(snapshot.recentCycleHeartbeats.map((entry) => entry.cycleId)).toEqual([
        "cycle-new",
        "cycle-old",
      ]);
      expect(snapshot.recentExecutionOutcomes.map((entry) => entry.entryId)).toEqual([
        "entry-new",
        "entry-old",
      ]);
      expect(snapshot.recentDecisionExplanations.map((entry) => entry.opportunityId)).toEqual([
        "opp-new",
      ]);
    } finally {
      rmSync(directoryPath, { recursive: true, force: true });
    }
  });

  it("skips malformed NDJSON lines and still returns valid persisted runtime truth", () => {
    const directoryPath = createTempDir("gridly-runtime-truth-malformed-");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const store = new FileExecutionJournalStore({ directoryPath });

      store.appendHeartbeat({
        entryKind: "cycle_heartbeat",
        cycleId: "cycle-valid",
        recordedAt: "2026-03-16T10:30:00.000Z",
        executionPosture: "normal",
        commandsIssued: 1,
        commandsSkipped: 0,
        commandsFailed: 0,
        commandsSuppressed: 0,
        failClosedTriggered: false,
        nextCycleExecutionCaution: "normal",
        schemaVersion: "cycle-heartbeat.v1",
      });
      store.append({
        entryId: "entry-valid",
        cycleId: "cycle-valid",
        recordedAt: "2026-03-16T10:30:00.000Z",
        executionRequestId: "request-valid",
        idempotencyKey: "key-valid",
        targetDeviceId: "battery",
        canonicalCommand: {
          commandId: "cmd-valid",
          targetDeviceId: "battery",
          kind: "set_mode",
          mode: "charge",
          effectiveWindow: {
            startAt: "2026-03-16T10:30:00.000Z",
            endAt: "2026-03-16T11:00:00.000Z",
          },
        },
        status: "issued",
        schemaVersion: "execution-journal.v1",
      });
      store.appendDecisionExplanation({
        type: "decision.explained",
        timestamp: "2026-03-16T10:30:00.000Z",
        cycleId: "cycle-valid",
        opportunityId: "opp-valid",
        decision: "rejected_preflight_validation",
        targetDeviceId: "battery",
        explanation: {
          summary: "Decision rejected_preflight_validation for opportunity opp-valid: CAPABILITIES_NOT_FOUND",
          drivers: ["Decision outcome: rejected_preflight_validation.", "Opportunity: opp-valid."],
          confidence: "low",
          confidence_reason: "Planning confidence signal: low.",
          caution: "CAPABILITIES_NOT_FOUND",
        },
        schemaVersion: "decision-explained.v1",
      });

      appendFileSync(join(directoryPath, "cycle-heartbeat.ndjson"), "{bad heartbeat json\n", { encoding: "utf-8" });
      appendFileSync(join(directoryPath, "execution-journal.ndjson"), "{bad journal json\n", { encoding: "utf-8" });
      appendFileSync(join(directoryPath, "decision-explained.ndjson"), "{bad decision explained json\n", { encoding: "utf-8" });

      const snapshot = buildRuntimeTruthApiResponse({ journalDirectoryPath: directoryPath });

      expect(snapshot.latestCycleHeartbeat?.cycleId).toBe("cycle-valid");
      expect(snapshot.recentExecutionOutcomes[0]?.entryId).toBe("entry-valid");
      expect(snapshot.recentDecisionExplanations[0]?.opportunityId).toBe("opp-valid");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      rmSync(directoryPath, { recursive: true, force: true });
    }
  });
});