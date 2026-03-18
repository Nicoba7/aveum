import type {
  CycleHeartbeatEntry,
  DecisionExplainedJournalEntry,
  ExecutionJournalEntry,
} from "./executionJournal";

export const MAX_RECENT_CYCLE_HEARTBEATS = 5;
export const MAX_RECENT_EXECUTION_OUTCOMES = 6;

export interface RuntimeTruthSnapshot {
  latestCycleHeartbeat?: CycleHeartbeatEntry;
  recentCycleHeartbeats: CycleHeartbeatEntry[];
  recentExecutionOutcomes: ExecutionJournalEntry[];
  recentDecisionExplanations: DecisionExplainedJournalEntry[];
}

export interface RuntimeTruthApiResponse extends RuntimeTruthSnapshot {
  source: "durable_journal";
  fetchedAt: string;
}

function cloneCycleHeartbeat(entry: CycleHeartbeatEntry): CycleHeartbeatEntry {
  return { ...entry };
}

function cloneExecutionOutcome(entry: ExecutionJournalEntry): ExecutionJournalEntry {
  return { ...entry };
}

function cloneDecisionExplanation(
  entry: DecisionExplainedJournalEntry,
): DecisionExplainedJournalEntry {
  return {
    ...entry,
    explanation: {
      ...entry.explanation,
      drivers: [...entry.explanation.drivers],
    },
  };
}

function dedupeByKey<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  items.forEach((item) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(item);
  });

  return deduped;
}

function compareRecordedAtDesc(left: { recordedAt: string }, right: { recordedAt: string }): number {
  if (left.recordedAt === right.recordedAt) {
    return 0;
  }

  return left.recordedAt > right.recordedAt ? -1 : 1;
}

function compareTimestampDesc(left: { timestamp: string }, right: { timestamp: string }): number {
  if (left.timestamp === right.timestamp) {
    return 0;
  }

  return left.timestamp > right.timestamp ? -1 : 1;
}

export function buildRuntimeTruthSnapshot(input: {
  cycleHeartbeats: CycleHeartbeatEntry[];
  executionOutcomes: ExecutionJournalEntry[];
  decisionExplanations?: DecisionExplainedJournalEntry[];
}): RuntimeTruthSnapshot {
  const recentCycleHeartbeats = dedupeByKey(
    input.cycleHeartbeats
      .map(cloneCycleHeartbeat)
      .sort(compareRecordedAtDesc),
    (entry) => entry.cycleId ?? `${entry.recordedAt}:${entry.schemaVersion}`,
  ).slice(0, MAX_RECENT_CYCLE_HEARTBEATS);

  const recentExecutionOutcomes = dedupeByKey(
    input.executionOutcomes
      .map(cloneExecutionOutcome)
      .sort(compareRecordedAtDesc),
    (entry) => entry.entryId,
  ).slice(0, MAX_RECENT_EXECUTION_OUTCOMES);

  const recentDecisionExplanations = dedupeByKey(
    (input.decisionExplanations ?? [])
      .map(cloneDecisionExplanation)
      .sort(compareTimestampDesc),
    (entry) => `${entry.opportunityId}:${entry.timestamp}:${entry.decision}`,
  );

  return {
    latestCycleHeartbeat: recentCycleHeartbeats[0],
    recentCycleHeartbeats,
    recentExecutionOutcomes,
    recentDecisionExplanations,
  };
}
