import type {
  CycleHeartbeatEntry,
  DecisionExplainedJournalEntry,
  ExecutionJournalEntry,
} from "./executionJournal";
import {
  buildRuntimeTruthSnapshot,
  type RuntimeTruthApiResponse,
  type RuntimeTruthSnapshot,
} from "./runtimeTruthSnapshot";

type Listener = () => void;

const listeners = new Set<Listener>();
const DEFAULT_RUNTIME_TRUTH_ENDPOINT = "/api/runtime-truth";
const DEFAULT_POLLING_INTERVAL_MS = 15000;

let runtimeTruthSnapshot: RuntimeTruthSnapshot = buildRuntimeTruthSnapshot({
  cycleHeartbeats: [],
  executionOutcomes: [],
  decisionExplanations: [],
});
let pollingConsumers = 0;
let pollingTimer: ReturnType<typeof setInterval> | undefined;
let inFlightRefresh: Promise<void> | undefined;

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function applyRuntimeTruthSnapshot(snapshot: RuntimeTruthSnapshot): void {
  const cycleHeartbeats = snapshot.recentCycleHeartbeats.length > 0
    ? snapshot.recentCycleHeartbeats
    : snapshot.latestCycleHeartbeat
      ? [snapshot.latestCycleHeartbeat]
      : [];

  runtimeTruthSnapshot = buildRuntimeTruthSnapshot({
    cycleHeartbeats,
    executionOutcomes: snapshot.recentExecutionOutcomes,
    decisionExplanations: snapshot.recentDecisionExplanations,
  });
  notifyListeners();
}

/**
 * Browser-side cache/subscription seam for durable canonical runtime truth.
 *
 * UI layers may subscribe and render this value, but must never compute or
 * produce canonical runtime truth themselves.
 */
export function getLatestCycleHeartbeat(): CycleHeartbeatEntry | undefined {
  return runtimeTruthSnapshot.latestCycleHeartbeat;
}

export function getRecentCycleHeartbeats(): CycleHeartbeatEntry[] {
  return runtimeTruthSnapshot.recentCycleHeartbeats;
}

export function getRecentExecutionOutcomes(): ExecutionJournalEntry[] {
  return runtimeTruthSnapshot.recentExecutionOutcomes;
}

export function getRecentDecisionExplanations(): DecisionExplainedJournalEntry[] {
  return runtimeTruthSnapshot.recentDecisionExplanations;
}

export function getRuntimeTruthSnapshot(): RuntimeTruthSnapshot {
  return runtimeTruthSnapshot;
}

export function replaceRuntimeTruthSnapshot(snapshot: RuntimeTruthSnapshot): void {
  applyRuntimeTruthSnapshot(snapshot);
}

export function pushRecentExecutionOutcomes(entries: ExecutionJournalEntry[]): void {
  if (entries.length === 0) {
    return;
  }

  applyRuntimeTruthSnapshot(buildRuntimeTruthSnapshot({
    cycleHeartbeats: runtimeTruthSnapshot.recentCycleHeartbeats,
    executionOutcomes: [...entries, ...runtimeTruthSnapshot.recentExecutionOutcomes],
    decisionExplanations: runtimeTruthSnapshot.recentDecisionExplanations,
  }));
}

export function setLatestCycleHeartbeat(entry: CycleHeartbeatEntry | undefined): void {
  if (!entry) {
    applyRuntimeTruthSnapshot(buildRuntimeTruthSnapshot({
      cycleHeartbeats: [],
      executionOutcomes: [],
      decisionExplanations: [],
    }));
    return;
  }

  applyRuntimeTruthSnapshot(buildRuntimeTruthSnapshot({
    cycleHeartbeats: [entry, ...runtimeTruthSnapshot.recentCycleHeartbeats],
    executionOutcomes: runtimeTruthSnapshot.recentExecutionOutcomes,
    decisionExplanations: runtimeTruthSnapshot.recentDecisionExplanations,
  }));
}

export function subscribeLatestCycleHeartbeat(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function refreshRuntimeTruthFromApi(options?: {
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      return;
    }

    const response = await fetchImpl(options?.endpoint ?? DEFAULT_RUNTIME_TRUTH_ENDPOINT, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json() as Partial<RuntimeTruthApiResponse>;
    applyRuntimeTruthSnapshot({
      latestCycleHeartbeat: payload.latestCycleHeartbeat,
      recentCycleHeartbeats: Array.isArray(payload.recentCycleHeartbeats) ? payload.recentCycleHeartbeats : [],
      recentExecutionOutcomes: Array.isArray(payload.recentExecutionOutcomes) ? payload.recentExecutionOutcomes : [],
      recentDecisionExplanations: Array.isArray(payload.recentDecisionExplanations)
        ? payload.recentDecisionExplanations
        : [],
    });
  })().catch(() => {
    // Keep the last good browser cache when the bridge is temporarily unavailable.
  }).finally(() => {
    inFlightRefresh = undefined;
  });

  return inFlightRefresh;
}

export function startRuntimeTruthPolling(options?: {
  endpoint?: string;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
}): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  pollingConsumers += 1;

  if (!pollingTimer) {
    void refreshRuntimeTruthFromApi(options);
    pollingTimer = setInterval(() => {
      void refreshRuntimeTruthFromApi(options);
    }, options?.intervalMs ?? DEFAULT_POLLING_INTERVAL_MS);
  }

  return () => {
    pollingConsumers = Math.max(0, pollingConsumers - 1);

    if (pollingConsumers === 0 && pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    }
  };
}