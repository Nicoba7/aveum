export type DecisionFreshnessState = "live" | "delayed" | "stale";
export type DecisionFreshnessLabelKind = "updated" | "last-decision";

export interface DecisionFreshnessViewModel {
  label: string;
  state: DecisionFreshnessState;
}

export const DECISION_FRESHNESS_TOOLTIP = "This view reflects real runtime decisions and updates automatically.";

function secondsSince(timestamp: string | undefined, nowMs: number): number | undefined {
  if (!timestamp) {
    return undefined;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.floor((nowMs - parsed) / 1000));
}

function formatRelativeAge(elapsedSeconds: number): string {
  if (elapsedSeconds <= 1) {
    return "just now";
  }

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s ago`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 48) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

export function buildDecisionFreshnessViewModel(
  timestamp: string | undefined,
  nowMs: number,
  labelKind: DecisionFreshnessLabelKind = "updated"
): DecisionFreshnessViewModel {
  const elapsedSeconds = secondsSince(timestamp, nowMs);
  const prefix = labelKind === "last-decision" ? "Last decision" : "Updated";

  if (elapsedSeconds === undefined) {
    return {
      label: "Stale",
      state: "stale",
    };
  }

  const relativeAge = formatRelativeAge(elapsedSeconds);
  const ageLabel = `${prefix} ${relativeAge}`;

  if (elapsedSeconds <= 30) {
    return {
      label: `Live · ${ageLabel}`,
      state: "live",
    };
  }

  if (elapsedSeconds <= 120) {
    return {
      label: `Delayed · ${ageLabel}`,
      state: "delayed",
    };
  }

  return {
    label: ageLabel,
    state: "stale",
  };
}
