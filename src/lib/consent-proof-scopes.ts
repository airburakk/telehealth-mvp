// Onay Kanıtı kapsam sekmeleri — ROL kesiti (kontrol raporu 2026-09-17 H12, v6.283).
// Eskiden /onam/kanit her kullanıcıya on sekmeyi gösteriyordu: hasta "Personel aydınlatma", "Kurumsal başvuru",
// "Doctorium sözleşme" gibi kendisiyle ilgisiz kapsamları görüyordu (hepsi "kayıt yok"). Sekme listesi artık sunucuda
// role göre kesilir; API zaten kullanıcının kendi kaydını döndürür (yetki burada değil, sunumdadır).
export type ProofScope = { key: string; label: string };

export const CONSENT_PROOF_SCOPES: readonly ProofScope[] = [
  { key: "GENERAL_KVKK", label: "Aydınlatma + açık rıza" },
  { key: "AURA_TERMS", label: "Kullanım Koşulları" },
  { key: "STAFF_KVKK", label: "Personel aydınlatma" },
  { key: "AI_TRIAGE", label: "AI ön değerlendirme" },
  { key: "AI_INTERPRET", label: "AI tercüme" },
  { key: "HEALTH_DECLARATION", label: "Sigorta beyanı" },
  { key: "STAFF_APPLICATION_KVKK", label: "Kurumsal başvuru" },
  { key: "DOCTORIUM_KVKK", label: "Doctorium aydınlatma" },
  { key: "DOCTORIUM_TERMS", label: "Doctorium sözleşme" },
  { key: "DOCTORIUM_DIPLOMA_BEYAN", label: "Diploma beyanı" },
];

const PATIENT_SCOPES = ["GENERAL_KVKK", "AURA_TERMS", "AI_TRIAGE", "AI_INTERPRET", "HEALTH_DECLARATION"];
const STAFF_SCOPES = ["AURA_TERMS", "STAFF_KVKK", "STAFF_APPLICATION_KVKK", "DOCTORIUM_KVKK", "DOCTORIUM_TERMS", "DOCTORIUM_DIPLOMA_BEYAN"];

/** Role göre gösterilecek sekmeler: hasta yalnız hasta kapsamları · ADMIN hepsi · diğer personel rolleri personel+Doctorium ·
 *  rol bilinmiyorsa (kimliksiz) tam liste (sayfa zaten giriş ister). */
export function proofScopesForRole(role: string | null | undefined): ProofScope[] {
  if (!role || role === "ADMIN") return [...CONSENT_PROOF_SCOPES];
  const allow = role === "PATIENT" ? PATIENT_SCOPES : STAFF_SCOPES;
  return CONSENT_PROOF_SCOPES.filter((s) => allow.includes(s.key));
}
