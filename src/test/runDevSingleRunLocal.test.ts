import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDevSingleRunLocal } from "../application/runtime/runDevSingleRunLocal";
import { buildRuntimeTruthApiResponse } from "../journal/runtimeTruthServer";

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("runDevSingleRunLocal", () => {
  it("persists a durable explanation-bearing runtime cycle for local iteration", async () => {
    const directoryPath = createTempDir("gridly-dev-single-run-");

    try {
      const summary = await runDevSingleRunLocal({
        GRIDLY_JOURNAL_DIR: directoryPath,
      });

      expect(summary.status).toBe("ok");
      if (summary.status !== "ok") {
        throw new Error("expected success summary");
      }

      expect(summary.executionJournalEntries.length).toBeGreaterThan(0);
      expect(existsSync(join(directoryPath, "decision-explained.ndjson"))).toBe(true);

      const explanationLines = readFileSync(join(directoryPath, "decision-explained.ndjson"), "utf-8")
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(explanationLines.length).toBeGreaterThan(0);

      const snapshot = buildRuntimeTruthApiResponse({ journalDirectoryPath: directoryPath });
      expect(snapshot.recentDecisionExplanations.length).toBeGreaterThan(0);
      expect(snapshot.recentDecisionExplanations[0].explanation.drivers.length).toBeGreaterThanOrEqual(2);
      expect(snapshot.latestCycleHeartbeat?.economicSnapshot?.planningStyle).toBe("balanced");
    } finally {
      rmSync(directoryPath, { recursive: true, force: true });
    }
  });
});
