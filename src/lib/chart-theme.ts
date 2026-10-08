"use client";

import { useEffect, useState } from "react";

/**
 * Resolved colours for chart internals.
 *
 * Recharts writes these onto SVG presentation attributes (`fill`, `stroke`),
 * where a raw `var(--token)` is not reliably resolved. So instead of handing it
 * the variable, we read the variable's computed value and hand it a concrete
 * colour — and recompute whenever the `light` class on <html> flips.
 */
export interface ChartTokens {
  /** Axis tick labels. */
  tick: string;
  /** Dimmer tick labels / secondary axis. */
  tickMuted: string;
  /** Emphasised labels drawn on top of bars. */
  label: string;
  /** Grid and reference lines. */
  grid: string;
  /** Hover highlight behind a bar or column. */
  cursor: string;
}

const FALLBACK: ChartTokens = {
  tick:      "rgba(255,255,255,0.40)",
  tickMuted: "rgba(255,255,255,0.30)",
  label:     "rgba(255,255,255,0.55)",
  grid:      "rgba(255,255,255,0.08)",
  cursor:    "rgba(255,255,255,0.04)",
};

function readTokens(): ChartTokens {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;

  return {
    tick:      get("--fg-5", FALLBACK.tick),
    tickMuted: get("--fg-6", FALLBACK.tickMuted),
    label:     get("--fg-4", FALLBACK.label),
    grid:      get("--bd", FALLBACK.grid),
    cursor:    get("--bg-faint", FALLBACK.cursor),
  };
}

export function useChartTokens(): ChartTokens {
  // Start from the fallback so server and first client render agree.
  const [tokens, setTokens] = useState<ChartTokens>(FALLBACK);

  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();

    // The theme switch toggles a class on <html>; re-read when it changes.
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
