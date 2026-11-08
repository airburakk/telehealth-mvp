/** Editorial preparation only. No patient data, eligibility rules, or clinical instructions. */
export interface WorkflowEditorialReview {
  sources: readonly {
    url: string; version: string; locator: string; applicability: string;
    verifiedOn: string; effectiveFrom: string; effectiveUntil: string | null;
  }[];
  clinical: { reviewer: string; reviewedOn: string } | null;
  legal: { reviewer: string; reviewedOn: string } | null;
  nextReviewOn: string | null;
  requiresPatientData: boolean;
}
export interface FamilyMedicineWorkflow {
  id: string;
  kind: "report" | "asm";
  title: string;
  summary: string;
  status: "draft" | "approved";
  sourceIds: readonly string[];
  sourceGap: string | null;
  preparationQuestions: readonly string[];
  review: WorkflowEditorialReview;
}
const pendingReview = (): WorkflowEditorialReview => ({ sources: [], clinical: null, legal: null, nextReviewOn: null, requiresPatientData: false });
const reportQuestions = [
  "Talep edilen raporun amacı ve talep eden kurumun güncel resmî açıklaması hangi kaynaktan doğrulanacak?",
  "Bu rapor türüne uygulanacak yönetmelik maddesi, belge sürümü ve yürürlük tarihi editör tarafından eşleştirildi mi?",
  "Başvuru kanalı ve işlem yetkisi için yetkili kurumun güncel açıklaması bulundu mu?",
  "Hastaya verilecek genel hazırlık metni hekim ve hukuk incelemesinden geçti mi?",
] as const;
export const REPORT_WORKFLOWS: readonly FamilyMedicineWorkflow[] = [
  ["driver", "Sürücü raporu"], ["employment", "İşe giriş raporu"], ["marriage", "Evlilik öncesi rapor"],
  ["military", "Askerlik işlemleri"], ["sick-leave", "İstirahat raporu"],
].map(([id, title]) => ({
  id, kind: "report", title, status: "draft", summary: "İşlem akışı hazırlığı. Muayene, tetkik, sevk veya rapor sonucu önermez.",
  sourceIds: ["report-regulation", "report-repeal"],
  sourceGap: "2026 yönetmeliği ve eski yönergenin kaldırıldığı duyurusu genel başlangıç kaynaklarıdır. Bu rapor türüne özgü madde, yetki ve varsa özel düzenlemeler henüz eşleştirilmedi; eski yönerge güncel kural olarak kullanılmaz.",
  preparationQuestions: reportQuestions, review: pendingReview(),
}));
export const ASM_WORKFLOWS: readonly FamilyMedicineWorkflow[] = [
  ["cold-chain", "Soğuk zincir kayıtları"], ["expiry", "Malzeme ve miat takibi"],
  ["maintenance", "Cihaz bakım kayıtları"], ["hygiene", "Temizlik ve hijyen belgeleri"], ["training", "Personel eğitim kayıtları"],
].map(([id, title]) => ({
  id, kind: "asm", title, status: "draft", summary: "Kontrol listesi hazırlığı. Resmî denetim listesi veya uygunluk beyanı değildir.",
  sourceIds: ["asm-forms"],
  sourceGap: "01.09.2026 sürümlü form duyurusu başlangıç kaynağıdır. Bu başlığa ait form/madde, yerel kapsam ve varsa sonraki değişiklikler henüz tek tek doğrulanmadı.",
  preparationQuestions: [
    "Bu başlığın güncel resmî formdaki karşılığı ve madde numarası doğrulandı mı?",
    "Kontrolün kapsamı, sorumluluk ve kayıt biçimi yetkili kaynağa bağlandı mı?",
    "Yerel uygulama farkları ve yürürlük tarihleri editör tarafından incelendi mi?",
    "Hasta bilgisi içermeyen genel kontrol listesi hekim ve hukuk incelemesinden geçti mi?",
  ], review: pendingReview(),
}));

function day(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}
const filled = (value: string) => value.trim().length > 0;
/** Fail-closed content validation, NOT reviewer authentication or permission to deploy. */
export function workflowPublicationGate(workflow: FamilyMedicineWorkflow, now: Date): { publishable: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!Number.isFinite(now.getTime())) return { publishable: false, blockers: ["Kontrol tarihi geçersiz."] };
  const today = day(now.toISOString().slice(0, 10))!;
  if (workflow.status !== "approved") blockers.push("İçerik taslak durumunda; yayın onayı yok.");
  if (workflow.sourceGap) blockers.push("Konuya özgü kaynak ve madde eşleştirmesi tamamlanmadı.");
  if (workflow.review.requiresPatientData) blockers.push("Bu çalışma alanı hasta verisi işlemez.");
  const sources = workflow.review.sources;
  if (sources.length === 0) blockers.push("Doğrulanmış kaynak sürümü ve madde kaydı eksik.");
  for (const source of sources) {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new Error("invalid-source");
    } catch { blockers.push("Kaynak bağlantısı geçerli, kimlik bilgisi içermeyen HTTPS adresi olmalı."); }
    if (![source.version, source.locator, source.applicability].every(filled)) blockers.push("Kaynak sürümü, madde ve uygulanabilirlik açıklaması eksik.");
    const verified = day(source.verifiedOn), starts = day(source.effectiveFrom), ends = day(source.effectiveUntil);
    if (verified === null || verified > today) blockers.push("Kaynak kontrol tarihi geçersiz veya gelecekte.");
    if (starts === null || starts > today) blockers.push("Kaynağın yürürlük tarihi geçersiz veya henüz yürürlükte değil.");
    if (source.effectiveUntil !== null && (ends === null || ends < today || (starts !== null && ends < starts))) blockers.push("Kaynağın yürürlük süresi geçersiz veya sona ermiş.");
  }
  for (const [label, approval] of [["Hekim", workflow.review.clinical], ["Hukuk", workflow.review.legal]] as const) {
    const reviewed = day(approval?.reviewedOn ?? null);
    if (!approval || !filled(approval.reviewer) || reviewed === null || reviewed > today) {
      blockers.push(`${label} incelemesi ve geçerli inceleme tarihi eksik.`);
    } else if (sources.some(source => { const verified = day(source.verifiedOn); return verified !== null && reviewed < verified; })) {
      blockers.push(`${label} incelemesi son kaynak doğrulamasından eski.`);
    }
  }
  const next = day(workflow.review.nextReviewOn);
  if (next === null || next <= today) blockers.push("Yeniden inceleme tarihi eksik, geçersiz veya gelmiş.");
  return { publishable: blockers.length === 0, blockers: [...new Set(blockers)] };
}
