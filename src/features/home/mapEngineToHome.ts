/**
 * Maps raw Gridly engine output to Home screen UI props.
 *
 * This keeps UI components simple and prevents business logic
 * from leaking into page components.
 */

import type { GridlyOutput } from "../../engine/types";

export type HomeViewModel = {
  headline: string
  subheadline?: string
  actionCount: number
  confidence?: number
  savings?: number
}

export function mapEngineToHome(output: GridlyOutput): HomeViewModel {
  return {
    headline: output.headline ?? "Gridly is evaluating the best energy strategy",
    subheadline: output.subheadline,
    actionCount: output.recommendations.length,
    confidence: output.confidence,
    savings: output.counterfactual?.savings
  }
}