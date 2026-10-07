import { BRANCHES, canonicalBranchLabel } from "./triage";
import { BRANCH_LABELS } from "./procedures";

// Doctor/medical-student choices use the full physician taxonomy, not the
// procedure catalogue. Keep every previously selectable label for compatibility.
// This does not change PATIENT_BRANCHES or add any procedures or prices.
export const DOCTOR_BRANCH_OPTIONS: string[] = [...new Set([
  ...Object.values(BRANCH_LABELS),
  ...BRANCHES.map(branch => branch.label),
])].sort((a, b) => a.localeCompare(b, "tr"));

const ACCEPTED_LABELS = new Set(DOCTOR_BRANCH_OPTIONS);

// Existing account labels retain their stored spelling; known historical
// aliases remain accepted, but no arbitrary label or slug becomes a choice.
export function isDoctorBranch(label: string): boolean {
  return ACCEPTED_LABELS.has(canonicalBranchLabel(label));
}
