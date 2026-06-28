// M5 — Hekim hesap aktivasyon kapısı.
// Zorunlu mesleki belgeler (Tıp Diploması + Mesleki Mali Sorumluluk Sigortası/MMSS) yüklenip MMSS
// metadata'sı (teminat limiti dahil) tamamlanmadan hekim klinik panellere erişemez. Koşul sağlanınca
// Doctor.activatedAt damgalanır; eksilirse damga geri alınır (gate yeniden devreye girer).
// MMSS teminat limiti aynı zamanda M3 Katman 3 malpraktis ek-prim hesabının girdisidir.
import { db } from "@/lib/db";

// Hesap aktivasyonu için yüklenmesi ZORUNLU belge tipleri (sertifika/akademik ihtiyari).
export const REQUIRED_DOC_TYPES = ["DIPLOMA", "MMSS"] as const;
export const ALL_DOC_TYPES = ["DIPLOMA", "MMSS", "CERTIFICATE", "ACADEMIC"] as const;
export type DoctorDocType = (typeof ALL_DOC_TYPES)[number];

type MmssMeta = { mmssInsurer: string | null; mmssPolicyNo: string | null; mmssCoverageLimit: number | null };

// MMSS metadata tam mı? Teminat limiti (Katman 3 girdisi) + sigortacı + poliçe no şart.
export function mmssComplete(d: MmssMeta): boolean {
  return !!d.mmssInsurer && !!d.mmssPolicyNo && typeof d.mmssCoverageLimit === "number" && d.mmssCoverageLimit > 0;
}

// Zorunlu belge dosyaları (diploma + MMSS) yüklü mü?
export function hasRequiredDocs(docs: { type: string }[]): boolean {
  const types = new Set(docs.map((x) => x.type));
  return REQUIRED_DOC_TYPES.every((t) => types.has(t));
}

// Hesap aktif edilebilir mi (damga atılabilir): zorunlu belgeler + MMSS metadata tam.
export function canActivate(docs: { type: string }[], mmss: MmssMeta): boolean {
  return hasRequiredDocs(docs) && mmssComplete(mmss);
}

// Klinik panel erişimi için: aktivasyon damgası var mı?
export function isActivated(d: { activatedAt: Date | null }): boolean {
  return !!d.activatedAt;
}

// Eksik zorunlu adımları döndür (UI'da yönlendirme metni için).
export function missingSteps(docs: { type: string }[], mmss: MmssMeta): string[] {
  const types = new Set(docs.map((x) => x.type));
  const out: string[] = [];
  if (!types.has("DIPLOMA")) out.push("Tıp diploması");
  if (!types.has("MMSS")) out.push("MMSS poliçesi");
  if (!mmssComplete(mmss)) out.push("MMSS poliçe bilgileri (teminat limiti dahil)");
  return out;
}

// ── M5 Kayıt — ilk-onboarding ek zorunlulukları (yalnız self-signup hekim ilk kez tamamlarken) ──
// Global canActivate/refreshActivation (belge/MMSS değişiminde TÜM hekimlerde çalışır) DEĞİŞMEZ →
// mevcut hekimlerde regresyon yok. Aşağıdaki ek koşullar yalnız onboarding finish yolunda uygulanır:
// ≥1 işlem+ücret (FHIR ServiceRequest/ChargeItem girdisi) + FHIR qualification (diploma/tescil no =
// Practitioner.identifier · uzmanlık belgesi = Practitioner.qualification).

// En az bir işlem+ücret seçili mi (Doctor.procedures JSON {kod:₺})?
export function hasProcedures(proceduresJson: string | null): boolean {
  if (!proceduresJson) return false;
  try {
    const o = JSON.parse(proceduresJson);
    return !!o && typeof o === "object" && Object.keys(o as object).length > 0;
  } catch {
    return false;
  }
}

// FHIR qualification tam mı: diploma/tescil no + uzmanlık belgesi.
export function hasQualification(d: { licenseNo: string | null; specBoard: string | null }): boolean {
  return !!(d.licenseNo && d.licenseNo.trim()) && !!(d.specBoard && d.specBoard.trim());
}

type OnboardingData = MmssMeta & { procedures: string | null; licenseNo: string | null; specBoard: string | null };

// Onboarding tamamlanabilir mi: zorunlu belgeler + MMSS + ≥1 işlem + FHIR qualification.
export function canCompleteOnboarding(docs: { type: string }[], d: OnboardingData): boolean {
  return canActivate(docs, d) && hasProcedures(d.procedures) && hasQualification(d);
}

// Onboarding için eksik adımlar (UI yönlendirme metni).
export function missingOnboardingSteps(docs: { type: string }[], d: OnboardingData): string[] {
  const out = missingSteps(docs, d);
  if (!hasProcedures(d.procedures)) out.push("En az bir işlem ve ücreti");
  if (!d.licenseNo || !d.licenseNo.trim()) out.push("Diploma / tescil no");
  if (!d.specBoard || !d.specBoard.trim()) out.push("Uzmanlık belgesi");
  return out;
}

// DB-yan-etkili: belgeler + MMSS metadata'sını okuyup activatedAt damgasını eşitler.
// Belge yükleme / silme / MMSS kaydı sonrası çağrılır. Aktif olabiliyorsa damga atar, olamıyorsa kaldırır.
// Döndürür: hesap şu an aktif mi.
export async function refreshActivation(doctorId: string): Promise<boolean> {
  const [docs, doc] = await Promise.all([
    db.doctorDocument.findMany({ where: { doctorId }, select: { type: true } }),
    db.doctor.findUnique({
      where: { id: doctorId },
      select: { mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, activatedAt: true },
    }),
  ]);
  if (!doc) return false;
  const ok = canActivate(docs, doc);
  if (ok && !doc.activatedAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { activatedAt: new Date() } });
  } else if (!ok && doc.activatedAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { activatedAt: null } });
  }
  return ok;
}
