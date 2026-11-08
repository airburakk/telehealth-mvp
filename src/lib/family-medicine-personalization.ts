import { FAMILY_MEDICINE_BRANCH } from "./family-medicine";

export type FamilyMedicinePreferenceAddition = {
  status: "added" | "already-included" | "limit" | "unavailable";
  branches: string[];
};
/** Explicit opt-in only. Preserve the implicit own-specialty fallback before adding a branch. */
export function familyMedicinePreferenceAddition(
  selected: readonly string[],
  ownBranchSlug: string | null,
  availableBranches: readonly string[],
): FamilyMedicinePreferenceAddition {
  const existing = [...new Set(selected)];
  const effective = existing.length ? existing : ownBranchSlug && availableBranches.includes(ownBranchSlug) ? [ownBranchSlug] : [];
  if (effective.includes(FAMILY_MEDICINE_BRANCH)) return { status: "already-included", branches: existing };
  if (!availableBranches.includes(FAMILY_MEDICINE_BRANCH)) return { status: "unavailable", branches: existing };
  const next = [...effective, FAMILY_MEDICINE_BRANCH];
  // Match the existing server preference ceiling without silently dropping another branch.
  if (next.length > 30) return { status: "limit", branches: existing };
  return { status: "added", branches: next };
}
