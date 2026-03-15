import { ENERGY_GLOW_TOKENS } from "./energyUiTokens";

export type TimelineEmphasisState = "active" | "soon" | "planned" | "default";
export type HomeTimelineEmphasisState = "now" | "upNext" | "default";

export const TIMELINE_EMPHASIS_TOKENS = {
  active: {
    background: "#0F1E31",
    boxShadow: "inset 0 0 0 1px #1C3552",
    borderLeft: "2px solid #3B82F6",
    textColor: "#DEE6F3",
    fontWeight: 650,
  },
  soon: {
    background: "#0C1828",
    boxShadow: "inset 0 0 0 1px #152D46",
    borderLeft: "2px solid #274A6F",
    textColor: "#D0DAEA",
    fontWeight: 620,
  },
  planned: {
    background: "#0A1422",
    boxShadow: "inset 0 0 0 1px #12263D",
    borderLeft: "2px solid #1F3A5A",
    textColor: "#BBC9DE",
    fontWeight: 580,
  },
  default: {
    background: "transparent",
    boxShadow: "none",
    borderLeft: "2px solid transparent",
    textColor: "#99A7BC",
    fontWeight: 500,
  },
} as const;

export const HOME_TIMELINE_EMPHASIS_TOKENS = {
  now: {
    background: "#12243B",
    boxShadow: "inset 0 0 0 1px #2B4464, 0 0 0 1px rgba(100, 154, 221, 0.10)",
    borderLeft: "2px solid #67A2E6",
    textColor: "#E7F0FD",
    fontWeight: 680,
  },
  upNext: {
    background: "#0D1A2E",
    boxShadow: "inset 0 0 0 1px #1F3554",
    borderLeft: "2px solid #3E628C",
    textColor: "#CAD9EE",
    fontWeight: 620,
  },
  default: {
    background: "transparent",
    boxShadow: "none",
    borderLeft: "2px solid transparent",
    textColor: "#8A98AE",
    fontWeight: 500,
  },
} as const;

export function timelineDotGlow(
  state: TimelineEmphasisState,
  dot: string,
  isLeadingDefault = false
) {
  const template =
    state === "active"
      ? ENERGY_GLOW_TOKENS.timelineDot.active
      : state === "soon"
      ? ENERGY_GLOW_TOKENS.timelineDot.soon
      : state === "planned"
      ? ENERGY_GLOW_TOKENS.timelineDot.planned
      : isLeadingDefault
      ? ENERGY_GLOW_TOKENS.timelineDot.defaultLeading
      : ENERGY_GLOW_TOKENS.timelineDot.none;

  return template.replaceAll("%DOT%", dot);
}

export function homeTimelineDotGlow(state: HomeTimelineEmphasisState, dot: string) {
  const template =
    state === "now"
      ? "0 0 10px %DOT%, 0 0 18px %DOT%75"
      : state === "upNext"
      ? "0 0 7px %DOT%, 0 0 13px %DOT%50"
      : "none";

  return template.replaceAll("%DOT%", dot);
}
