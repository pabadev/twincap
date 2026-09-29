export const CREDIT_HIGHLIGHT_DURATION_MS = 3000;

export function resolveCreditHighlightTarget(
  targetId: string | null,
  creditIds: readonly string[],
): string | null {
  return targetId && creditIds.includes(targetId) ? targetId : null;
}

export function creditHighlightScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}
