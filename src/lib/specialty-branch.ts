// Uzmanlık branşı seçenekleri — kayıt formlarının kabul ettiği liste (lib/procedures BRANCH_LABELS) EKSİ "others"
// ("Diğer (Sınıflandırılmamış)"). Sınıflandırılmamış branşı düzeltme kartı ve ucu (api/doctor/specialty-branch)
// bu listeyi kullanır: düzeltme yine "Diğer"e düşemesin. Sıra Türkçe alfabetik.
import { BRANCH_LABELS } from "./procedures";

export const SELECTABLE_SPECIALTY_BRANCHES: readonly string[] = Object.entries(BRANCH_LABELS)
  .filter(([key]) => key !== "others")
  .map(([, label]) => label)
  .sort((a, b) => a.localeCompare(b, "tr"));
