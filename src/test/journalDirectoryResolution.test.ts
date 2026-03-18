import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveContinuousRuntimeJournalDirectory } from "../application/runtime/runContinuousRuntime";
import { resolveJournalDirectoryPath } from "../journal/journalDirectory";
import { resolveRuntimeTruthJournalDirectory } from "../journal/runtimeTruthServer";

describe("journal directory resolution", () => {
  it("resolves GRIDLY_JOURNAL_DIR to the same absolute path across runtime and server", () => {
    const source = { GRIDLY_JOURNAL_DIR: "tmp/gridly-journal" };
    const cwd = "/opt/gridly";
    const expected = resolve(cwd, source.GRIDLY_JOURNAL_DIR);

    expect(resolveJournalDirectoryPath(source, { cwd })).toBe(expected);
    expect(resolveContinuousRuntimeJournalDirectory(source, { cwd })).toBe(expected);
    expect(resolveRuntimeTruthJournalDirectory(source, { cwd })).toBe(expected);
  });

  it("uses the same absolute default when GRIDLY_JOURNAL_DIR is unset", () => {
    const source = {};
    const cwd = "/opt/gridly";
    const expected = resolve(cwd, ".gridly/journal");

    expect(resolveJournalDirectoryPath(source, { cwd })).toBe(expected);
    expect(resolveContinuousRuntimeJournalDirectory(source, { cwd })).toBe(expected);
    expect(resolveRuntimeTruthJournalDirectory(source, { cwd })).toBe(expected);
  });
});