import { PricingState } from "../../hooks/useAgileRates";
import { PlanSlot, PlanSummary, ConnectedDeviceId, OptimisationMode, GridlyPlanSummary } from "../../lib/gridlyPlan";

export type PlanHeroViewModel = {
  title: string;
  value: string;
  outcomes: string[];
  trustNote: string;
  statusNote?: string;
};

export type PlanTimelineRow = {
  time: string;
  action: string;
  reason: string;
  value: string;
  color: string;
  highlight?: boolean;
  modeTag?: string;
  emphasis?: "high" | "medium" | "low";
  coreAction?: "charge_ev" | "charge_battery" | "export" | "solar" | "hold";
};

export type PlanTimelineViewModel = {
  rows: PlanTimelineRow[];
};

export type PriceWindowsViewModel = {
  cheapestWindow: string;
  cheapestRate: number;
  peakWindow: string;
  peakRate: number;
  solarWindow?: string;
  solarStrength?: string;
};

export type PlanSummaryViewModel = {
  title: string;
  summary: string;
  modeTag: string;
  highlights: string[];
};

export type AIInsightViewModel = {
  insight: string;
};

export type OptimisationModeViewModel = {
  mode: OptimisationMode;
  options: { id: OptimisationMode; label: string; description: string }[];
};

export function getBarColor(p: number) {
  if (p < 10) return "#22C55E";
  if (p < 20) return "#F59E0B";
  if (p < 30) return "#F97316";
  return "#EF4444";
}

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`;
}

function toSlotIndex(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 2) + (minutes >= 30 ? 1 : 0);
}

function toHHMM(slotIndex: number) {
  const normalized = ((slotIndex % 48) + 48) % 48;
  const hours = String(Math.floor(normalized / 2)).padStart(2, "0");
  const minutes = normalized % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
}

function formatRange(start: string, end: string) {
  if (start === end) return start;
  return `${start}–${end}`;
}

function getCoreAction(slot: PlanSlot): "charge_ev" | "charge_battery" | "export" | "solar" | "hold" {
  if (slot.decisionType === "ev_charge") return "charge_ev";
  if (slot.decisionType === "battery_charge") return "charge_battery";
  if (slot.decisionType === "export") return "export";
  if (slot.decisionType === "solar") return "solar";

  if (slot.action === "CHARGE") {
    return slot.requires.includes("ev") ? "charge_ev" : "charge_battery";
  }
  if (slot.action === "EXPORT") return "export";
  if (slot.action === "SOLAR") return "solar";
  return "hold";
}

function coreActionLabel(coreAction: "charge_ev" | "charge_battery" | "export" | "solar" | "hold") {
  if (coreAction === "charge_ev") return "Charge EV";
  if (coreAction === "charge_battery") return "Charge battery";
  if (coreAction === "export") return "Export to grid";
  if (coreAction === "solar") return "Use solar";
  return "Hold";
}

function compactReason(
  coreAction: "charge_ev" | "charge_battery" | "export" | "solar" | "hold",
  mode: OptimisationMode,
  hasManySlots: boolean,
  context: { hasBattery: boolean; hasSolar: boolean; hasBatteryCharge: boolean }
) {
  if (coreAction === "charge_battery") {
    if (mode === "CHEAPEST") return hasManySlots ? "Top up across the cheapest overnight windows." : "Top up when power is cheapest.";
    if (mode === "BALANCED") return "Small top-up to keep tomorrow comfortable and protected.";
    return "Only topping up if reserve support is needed.";
  }

  if (coreAction === "charge_ev") {
    if (mode === "CHEAPEST") return "Charge before morning in the lowest-price slots.";
    if (mode === "BALANCED") return "Charge steadily overnight so it is ready by morning.";
    return "Charge before morning in cleaner grid windows.";
  }

  if (coreAction === "export") {
    if (mode === "CHEAPEST") return "Sell power when prices are strongest.";
    if (mode === "BALANCED") return "Export only when value is clearly worthwhile.";
    return "Export mainly from clean surplus periods.";
  }

  if (coreAction === "solar") return "Let solar cover home demand around midday.";

  if (mode === "BALANCED" && context.hasBattery && !context.hasBatteryCharge) {
    return "Battery reserve is healthy, so Gridly avoids unnecessary overnight charging.";
  }

  if (mode === "GREENEST" && context.hasBattery && !context.hasBatteryCharge) {
    return context.hasSolar
      ? "Holding overnight so tomorrow’s solar can do more of the charging."
      : "Holding for cleaner grid periods before charging.";
  }

  if (mode === "CHEAPEST" && context.hasBattery && !context.hasBatteryCharge) {
    return "No strong overnight arbitrage window, so Gridly keeps your battery steady.";
  }

  return "No action needed in this window.";
}

export function buildPlanHeroViewModel({
  summary,
  gridlySummary,
  plan,
  pricingStatus,
  loading,
}: {
  summary: PlanSummary;
  gridlySummary: GridlyPlanSummary;
  plan: PlanSlot[];
  pricingStatus: PricingState;
  loading: boolean;
}): PlanHeroViewModel {
  const value = summary.projectedEarnings + summary.projectedSavings;

  const trustNote = loading
    ? "Updating with the latest prices."
    : pricingStatus === "live"
    ? "Using live prices — this plan updates automatically."
    : pricingStatus === "fallback_live"
    ? "Using estimated prices for now — live prices will update automatically."
    : "Using demo prices for preview mode.";

  const statusNote = loading
    ? "Loading prices..."
    : pricingStatus === "live"
    ? "Live pricing"
    : pricingStatus === "fallback_live"
    ? "Estimated pricing"
    : "Demo pricing";

  return {
    title: gridlySummary.planHeadline,
    value: `+${formatMoney(value)}`,
    outcomes: gridlySummary.keyOutcomes,
    trustNote,
    statusNote,
  };
}

export function buildPlanTimelineViewModel(
  plan: PlanSlot[],
  connectedDeviceIds: ConnectedDeviceId[],
  mode: OptimisationMode
): PlanTimelineViewModel {
  const filtered = plan.filter((slot) =>
    slot.requires.length === 0 || slot.requires.some((r) => connectedDeviceIds.includes(r))
  );
  const hasBattery = connectedDeviceIds.includes("battery");
  const hasSolar = connectedDeviceIds.includes("solar");

  const sorted = [...filtered].sort((a, b) => toSlotIndex(a.time) - toSlotIndex(b.time));
  const grouped: Array<{
    slots: PlanSlot[];
    coreAction: "charge_ev" | "charge_battery" | "export" | "solar" | "hold";
    endSlotIndex: number;
  }> = [];

  for (const slot of sorted) {
    const coreAction = getCoreAction(slot);
    const slotIndex = toSlotIndex(slot.time);
    const last = grouped[grouped.length - 1];

    if (!last) {
      grouped.push({ slots: [slot], coreAction, endSlotIndex: slotIndex });
      continue;
    }

    const consecutive = slotIndex === last.endSlotIndex + 1;
    const sameAction = last.coreAction === coreAction;

    if (consecutive && sameAction) {
      last.slots.push(slot);
      last.endSlotIndex = slotIndex;
    } else {
      grouped.push({ slots: [slot], coreAction, endSlotIndex: slotIndex });
    }
  }

  const hasBatteryCharge = grouped.some((group) => group.coreAction === "charge_battery");

  return {
    rows: grouped.map((group) => {
      const first = group.slots[0];
      const last = group.slots[group.slots.length - 1];
      const startIndex = toSlotIndex(first.time);
      const endIndex = toSlotIndex(last.time) + (group.slots.length > 1 ? 1 : 0);
      const minPrice = Math.min(...group.slots.map((slot) => slot.price));
      const maxPrice = Math.max(...group.slots.map((slot) => slot.price));

      return {
        time: formatRange(first.time, toHHMM(endIndex)),
        action: coreActionLabel(group.coreAction),
        reason: compactReason(group.coreAction, mode, group.slots.length > 1, {
          hasBattery,
          hasSolar,
          hasBatteryCharge,
        }),
        value: minPrice === maxPrice ? `${minPrice.toFixed(1)}p` : `${minPrice.toFixed(1)}–${maxPrice.toFixed(1)}p`,
        color: first.color,
        highlight: group.slots.some((slot) => slot.highlight),
        modeTag:
          mode === "CHEAPEST"
            ? "Cheapest plan"
            : mode === "BALANCED"
            ? "Balanced plan"
            : "Greenest plan",
        emphasis:
          group.coreAction === "export"
            ? "high"
            : group.coreAction === "charge_ev" || group.coreAction === "charge_battery"
            ? mode === "BALANCED"
              ? "medium"
              : "high"
            : "low",
        coreAction: group.coreAction,
      };
    }),
  };
}

export function buildPriceWindowsViewModel(
  summary: PlanSummary,
  solarSlot?: PlanSlot,
  solarForecastKwh?: number
): PriceWindowsViewModel {
  const solarStrength = solarForecastKwh
    ? solarForecastKwh > 15
      ? "Strong solar forecast"
      : "Solar expected"
    : undefined;

  return {
    cheapestWindow: summary.cheapestSlot,
    cheapestRate: summary.cheapestPrice,
    peakWindow: summary.peakSlot,
    peakRate: summary.peakPrice,
    solarWindow: solarSlot?.time,
    solarStrength,
  };
}

export function buildPlanSummaryViewModel({
  summary,
  gridlySummary,
}: {
  summary: PlanSummary;
  gridlySummary: GridlyPlanSummary;
}): PlanSummaryViewModel {
  return {
    title: "Why this plan works",
    summary: gridlySummary.customerReason,
    modeTag: summary.mode,
    highlights: gridlySummary.keyOutcomes,
  };
}

export function buildAIInsightViewModel({
  gridlySummary,
  summary,
  pricingStatus,
  mode,
}: {
  gridlySummary: GridlyPlanSummary;
  summary: PlanSummary;
  pricingStatus: PricingState;
  mode: OptimisationMode;
}): AIInsightViewModel | null {
  if (pricingStatus === "fallback_live") {
    return {
      insight: "Live prices are briefly unavailable, so Gridly is using a conservative estimate and will refresh automatically.",
    };
  }

  if (pricingStatus === "sandbox") {
    return {
      insight: "You’re viewing a demo plan. Connect live pricing to unlock real-time optimisation.",
    };
  }
  if (!gridlySummary.showInsightCard) return null;

  if (gridlySummary.intent === "use_solar" && mode === "GREENEST") {
    return {
      insight: "Balanced may look similar tonight, but Greenest is intentionally waiting for cleaner daytime and solar energy.",
    };
  }

  if (gridlySummary.intent === "avoid_peak_import" && mode === "BALANCED") {
    return {
      insight: "Balanced is holding steady because your reserve is already healthy and extra cycling adds little value tonight.",
    };
  }

  if (gridlySummary.intent === "capture_cheap_energy" && mode === "CHEAPEST") {
    return {
      insight: "Cheapest is leaning into low overnight prices to capture more value by tomorrow.",
    };
  }

  if (gridlySummary.intent === "protect_deadline") {
    return {
      insight: "Your EV deadline is the priority, so Gridly is shaping the rest of the plan around being ready on time.",
    };
  }

  if (gridlySummary.intent === "export_at_peak") {
    return {
      insight: "Gridly is saving flexibility for the most valuable part of tomorrow rather than acting early.",
    };
  }

  return null;
}

export function buildOptimisationModeViewModel(mode: OptimisationMode): OptimisationModeViewModel {
  return {
    mode,
    options: [
      {
        id: "CHEAPEST",
        label: "Cheapest",
        description: "Prioritise minimum import price and strong arbitrage windows.",
      },
      {
        id: "BALANCED",
        label: "Balanced",
        description: "Balance cost, battery wear, and clean energy periods.",
      },
      {
        id: "GREENEST",
        label: "Greenest",
        description: "Prioritise solar and lower-carbon windows over raw price.",
      },
    ],
  };
}
