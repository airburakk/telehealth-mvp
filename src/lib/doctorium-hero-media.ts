export type HeroConnection = { saveData?: boolean; effectiveType?: string };

/** A decorative film never overrides motion or data preferences. */
export function heroMotionAllowed(reducedMotion: boolean, connection?: HeroConnection) {
  return !reducedMotion && !connection?.saveData && !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
}

export function heroVideoEligible({ motionAllowed, desktop, requested, inView, tabVisible }: {
  motionAllowed: boolean; desktop: boolean; requested: boolean; inView: boolean; tabVisible: boolean;
}) {
  return motionAllowed && (desktop || requested) && inView && tabVisible;
}
