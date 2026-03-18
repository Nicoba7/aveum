import { resolve } from "node:path";

export interface JournalDirectorySource {
  GRIDLY_JOURNAL_DIR?: string;
}

export interface ResolveJournalDirectoryOptions {
  cwd?: string;
}

/**
 * Shared journal directory resolver used by runtime writers and server readers.
 * Produces a single absolute path from GRIDLY_JOURNAL_DIR (or default).
 */
export function resolveJournalDirectoryPath(
  source: JournalDirectorySource = process.env,
  options?: ResolveJournalDirectoryOptions,
): string {
  const configuredPath = source.GRIDLY_JOURNAL_DIR?.trim();
  const relativeOrAbsolutePath = configuredPath && configuredPath.length > 0
    ? configuredPath
    : ".gridly/journal";

  return resolve(options?.cwd ?? process.cwd(), relativeOrAbsolutePath);
}