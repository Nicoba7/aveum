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
    const configDirectoryPath = createTempDir("gridly-dev-config-");

    try {
      const summary = await runDevSingleRunLocal({
        GRIDLY_JOURNAL_DIR: directoryPath,
        GRIDLY_CONFIG_DIR: configDirectoryPath,
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
      rmSync(configDirectoryPath, { recursive: true, force: true });
    }
  });

  it("supports a deterministic planning-style contrast scenario with visibly different decisions", async () => {
    const cheapestDirectoryPath = createTempDir("gridly-dev-style-cheapest-");
    const balancedDirectoryPath = createTempDir("gridly-dev-style-balanced-");
    const greenestDirectoryPath = createTempDir("gridly-dev-style-greenest-");
    const configDirectoryPath = createTempDir("gridly-dev-style-config-");

    try {
      const cheapest = await runDevSingleRunLocal({
        GRIDLY_JOURNAL_DIR: cheapestDirectoryPath,
        GRIDLY_CONFIG_DIR: configDirectoryPath,
        GRIDLY_DEV_SCENARIO: "planning-style-contrast",
        GRIDLY_PLANNING_STYLE: "cheapest",
      });
      const cheapestSnapshot = buildRuntimeTruthApiResponse({ journalDirectoryPath: cheapestDirectoryPath });
      const cheapestDecision = cheapestSnapshot.recentDecisionExplanations[0]?.decision;

      const balanced = await runDevSingleRunLocal({
        GRIDLY_JOURNAL_DIR: balancedDirectoryPath,
        GRIDLY_CONFIG_DIR: configDirectoryPath,
        GRIDLY_DEV_SCENARIO: "planning-style-contrast",
        GRIDLY_PLANNING_STYLE: "balanced",
      });
      const balancedSnapshot = buildRuntimeTruthApiResponse({ journalDirectoryPath: balancedDirectoryPath });
      const balancedDecision = balancedSnapshot.recentDecisionExplanations[0]?.decision;

      const greenest = await runDevSingleRunLocal({
        GRIDLY_JOURNAL_DIR: greenestDirectoryPath,
        GRIDLY_CONFIG_DIR: configDirectoryPath,
        GRIDLY_DEV_SCENARIO: "planning-style-contrast",
        GRIDLY_PLANNING_STYLE: "greenest",
      });
      const greenestSnapshot = buildRuntimeTruthApiResponse({ journalDirectoryPath: greenestDirectoryPath });
      const greenestDecision = greenestSnapshot.recentDecisionExplanations[0]?.decision;

      expect(cheapest.status).toBe("ok");
      expect(balanced.status).toBe("ok");
      expect(greenest.status).toBe("ok");

      expect(cheapestDecision).toBe("charge_ev");
      expect(balancedDecision).toBe("rejected_eligibility");
      expect(greenestDecision).toBe("hold");
      expect(cheapestSnapshot.recentDecisionExplanations[0]?.explanation.summary.toLowerCase()).toContain("charging ev");
      expect(balancedSnapshot.recentDecisionExplanations[0]?.explanation.summary.toLowerCase()).toContain("not acting");
      expect(greenestSnapshot.recentDecisionExplanations[0]?.explanation.summary.toLowerCase()).toContain("idle");
    } finally {
      rmSync(cheapestDirectoryPath, { recursive: true, force: true });
      rmSync(balancedDirectoryPath, { recursive: true, force: true });
      rmSync(greenestDirectoryPath, { recursive: true, force: true });
      rmSync(configDirectoryPath, { recursive: true, force: true });
    }
  });
});
