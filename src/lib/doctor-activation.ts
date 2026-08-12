// M5 — Doktor hesap aktivasyon kapısı.
// Zorunlu mesleki belgeler (Tıp Diploması + Mesleki Mali Sorumluluk Sigortası/MMSS) yüklenip MMSS
// metadata'sı (teminat limiti dahil) tamamlanmadan doktor klinik panellere erişemez. Koşul sağlanınca
// Doctor.activatedAt damgalanır; eksilirse damga geri alınır (gate yeniden devreye girer).
// MMSS teminat limiti aynı zamanda M3 Katman 3 malpraktis ek-prim hesabının girdisidir.
import { db } from "@/lib/db";

// Hesap aktivasyonu için yüklenmesi ZORUNLU belge tipleri (sertifika/akademik ihtiyari).
// ⚠️ CHAMBER buraya EKLENMEZ: tabip odası yazısı Aşama 1'in (Doctorium) belgesidir, klinik
// aktivasyonun (Aşama 2) girdisi değildir — iki kapı birbirinden bağımsız damgalanır.
export const REQUIRED_DOC_TYPES = ["DIPLOMA", "MMSS"] as const;
export const ALL_DOC_TYPES = ["DIPLOMA", "MMSS", "CHAMBER", "CERTIFICATE", "ACADEMIC"] as const;
export type DoctorDocType = (typeof ALL_DOC_TYPES)[number];

// ── İki aşamalı giriş — AŞAMA 1: Doctorium kapısı (v6.87) ──────────────────────────────────────
// Tabip odası "Protokol Numaralı" üye yazısı (CHAMBER) yüklüyse Doctor.chamberLetterAt damgalanır
// (otomatik — admin onayı beklemez; kullanıcı kararı 2026-08-11). Doctorium erişimi damga VEYA
// klinik aktivasyonla açılır: Aşama 2'yi tamamlamış mevcut doktorlar CHAMBER'sız da içeridedir.

// Doctorium'a girebilir mi (saf — birim testlenebilir).
export function hasDoctoriumAccess(d: { chamberLetterAt: Date | null; activatedAt: Date | null }): boolean {
  return !!d.chamberLetterAt || !!d.activatedAt;
}

// Tabip odası yazısı yüklü mü?
export function hasChamberLetter(docs: { type: string }[]): boolean {
  return docs.some((x) => x.type === "CHAMBER");
}

// ── İki aşamalı giriş — AŞAMA 2: klinik yüzey kapısı (v6.87) ───────────────────────────────────
// Kural (kullanıcı kararı 2026-08-11): klinik aktivasyonu (activatedAt) olmayan DOCTOR yalnız
// Doctorium + /doktor/baslangic + /doktor/profil + /doktor/haberler'e girer; klinik yüzeyler
// (post-op izleme, vaka detayı, havuz sayfaları, nöbet API'si) KAPALIDIR. Nöbetçi istisnası
// DOĞALDIR: /gorusme rotası /doktor segmentinde değildir ve nöbet kapma yolları zaten
// verified+ONLINE ister — Aşama 1 doktoru nöbetçi olamaz, nöbetçiye düşen görüşme etkilenmez.
// ⚠️ Bu kapı hasDoctoriumAccess'in TERSİ YÖNÜDÜR: o "Doctorium'a kim girer"i, bu "Doctorium
// dışına kim çıkar"ı yanıtlar; CHAMBER yazısı klinik yüzey AÇMAZ.

// Klinik yüzeye girebilir mi (saf — birim testlenebilir).
export function hasClinicalAccess(d: { activatedAt: Date | null }): boolean {
  return !!d.activatedAt;
}

// DB-okur: oturum kullanıcısının KLİNİK-erişimli doktor bağlamı. null = doktor profili yok VEYA
// Aşama 2 tamamlanmamış → sayfa redirect("/doktor/baslangic"), API 403 döndürür. COORDINATOR/
// ADMIN gözetim rolleri bu kapıdan geçirilmez (rol muafiyeti çağıran tarafta — mevcut davranış).
// verified de döner: PHI taşıyan akışlar (ör. İcapçı kuyruğu) ownership kuralıyla ("doğrulanmamış
// hekim hiçbir vakaya erişemez") hizalanabilsin.
export async function clinicalDoctorFor(
  userId: string,
): Promise<{ doctorId: string; branch: string; verified: boolean } | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  if (!u?.doctorId) return null;
  const d = await db.doctor.findUnique({
    where: { id: u.doctorId },
    select: { activatedAt: true, verified: true, branch: true },
  });
  if (!d || !hasClinicalAccess(d)) return null;
  return { doctorId: u.doctorId, branch: d.branch, verified: d.verified };
}

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

// Eksik zorunlu adımları döndür (UI'da yönlendirme metni için).
export function missingSteps(docs: { type: string }[], mmss: MmssMeta): string[] {
  const types = new Set(docs.map((x) => x.type));
  const out: string[] = [];
  if (!types.has("DIPLOMA")) out.push("Tıp diploması");
  if (!types.has("MMSS")) out.push("MMSS poliçesi");
  if (!mmssComplete(mmss)) out.push("MMSS poliçe bilgileri (teminat limiti dahil)");
  return out;
}

// ── M5 Kayıt — ilk-onboarding ek zorunlulukları (yalnız self-signup doktor ilk kez tamamlarken) ──
// Global canActivate/refreshActivation (belge/MMSS değişiminde TÜM doktorlarde çalışır) DEĞİŞMEZ →
// mevcut doktorlarde regresyon yok. Aşağıdaki ek koşullar yalnız onboarding finish yolunda uygulanır:
// ≥1 işlem (FHIR ServiceRequest girdisi; ücret ARTIK onboarding'de değil, tedavi kararında belirlenir
// — 2026-07-10) + FHIR qualification (diploma/tescil no = Practitioner.identifier · uzmanlık belgesi =
// Practitioner.qualification).

// En az bir işlem seçili mi (Doctor.procedures JSON {kod:₺} — değer taban fiyat başlangıçlı)?
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

type OnboardingData = MmssMeta & {
  procedures: string | null; licenseNo: string | null; specBoard: string | null;
  // v6.87 OAuth boşluğu kapatıldı: Google/Apple hesabı branch/city BOŞ açılır ("" — doctor-signup.ts);
  // profil-tamamla ara sayfası doldurtur, burası API'den doğrudan finish'e karşı derinlik savunması.
  branch: string; city: string;
};

// Onboarding tamamlanabilir mi: zorunlu belgeler + MMSS + ≥1 işlem + FHIR qualification + kimlik (branş/şehir).
export function canCompleteOnboarding(docs: { type: string }[], d: OnboardingData): boolean {
  return canActivate(docs, d) && hasProcedures(d.procedures) && hasQualification(d) && !!d.branch.trim() && !!d.city.trim();
}

// Onboarding için eksik adımlar (UI yönlendirme metni).
export function missingOnboardingSteps(docs: { type: string }[], d: OnboardingData): string[] {
  const out = missingSteps(docs, d);
  if (!hasProcedures(d.procedures)) out.push("En az bir işlem seçimi");
  if (!d.licenseNo || !d.licenseNo.trim()) out.push("Diploma / tescil no");
  if (!d.specBoard || !d.specBoard.trim()) out.push("Uzmanlık belgesi");
  if (!d.branch.trim()) out.push("Branş bilgisi (profilinizi tamamlayın)");
  if (!d.city.trim()) out.push("Şehir bilgisi (profilinizi tamamlayın)");
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

// DB-yan-etkili: CHAMBER belgesinin varlığını Doctor.chamberLetterAt damgasına eşitler
// (refreshActivation deseni — belge yükleme/silme sonrası çağrılır; yazı silinirse damga düşer).
// Döndürür: doktorun GÜNCEL Doctorium erişimi (damga VEYA klinik aktivasyon).
export async function refreshChamberLetter(doctorId: string): Promise<boolean> {
  const [docs, doc] = await Promise.all([
    db.doctorDocument.findMany({ where: { doctorId, type: "CHAMBER" }, select: { type: true } }),
    db.doctor.findUnique({ where: { id: doctorId }, select: { chamberLetterAt: true, activatedAt: true } }),
  ]);
  if (!doc) return false;
  const has = hasChamberLetter(docs);
  if (has && !doc.chamberLetterAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { chamberLetterAt: new Date() } });
  } else if (!has && doc.chamberLetterAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { chamberLetterAt: null } });
  }
  return hasDoctoriumAccess({ chamberLetterAt: has ? new Date() : null, activatedAt: doc.activatedAt });
}
