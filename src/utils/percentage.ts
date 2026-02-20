/**
 * Clamp percentage-like values to a safe 0-100 range.
 */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
