// Small shared helpers for numeric form inputs.

/**
 * Parses a raw input value to a whole number clamped to `[min, max]`.
 * Empty/non-numeric input floors to `min`. Replaces the
 * `Math.max(min, Math.min(max, Math.floor(Number(raw) || 0)))` expression
 * that recurred across the planner/market/resident screens.
 */
export function clampInt(raw: unknown, min = 0, max = Infinity): number {
  return Math.max(min, Math.min(max, Math.floor(Number(raw) || 0)));
}
