// Physician specialties share the signup taxonomy. Unclassified is not a correction.
import { DOCTOR_BRANCH_OPTIONS } from "./doctor-branches";
import { BRANCH_LABELS } from "./procedures";

export const SELECTABLE_SPECIALTY_BRANCHES: readonly string[] = DOCTOR_BRANCH_OPTIONS
  .filter(label => label !== BRANCH_LABELS.others);