// M5 — Doktor hesap aktivasyon kapısı.
// Zorunlu mesleki belge (v6.105'ten beri YALNIZ Tıp Diploması — aşağıdaki karar notu) yüklenmeden
// doktor klinik panellere erişemez. Koşul sağlanınca Doctor.activatedAt damgalanır; eksilirse
// damga geri alınır (gate yeniden devreye girer). MMSS (Mesleki Mali Sorumluluk Sigortası)
// İHTİYARİ: yüklenirse teminat limiti M3 Katman 3 malpraktis ek-prim hesabının girdisidir.
import { db } from "@/lib/db";

// Hesap aktivasyonu için yüklenmesi ZORUNLU belge tipleri (sertifika/akademik ihtiyari).
// ⚠️ CHAMBER ve STUDENT_CERT buraya EKLENMEZ: ikisi de Aşama 1'in (Doctorium) belgesidir, klinik
// aktivasyonun (Aşama 2) girdisi değildir — kapılar birbirinden bağımsız damgalanır.
// v6.105 (kullanıcı kararı 2026-08-17): MMSS aktivasyon şartından ÇIKARILDI ("şimdilik kaldıralım")
// → tek zorunlu mesleki belge Tıp Diploması. MMSS kartı/formu İHTİYARİ olarak DURUYOR: yükleyen
// doktorun teminat limiti kaydedilmeye devam eder ve /paket sigorta paketini (M3 Katman 3) besler.
// ⚠️ Bu kapı GEVŞEME'dir, sıkılaşma değil → mevcut aktif doktorlar etkilenmez (aksi yönde olsaydı
// "Ders 1" regresyonu doğardı). Yan etki KASITLI: diploması olup MMSS'si olmadığı için bekleyen
// doktorlar, bir sonraki refreshActivation'da aktifleşir.
// 🔙 Geri alma: bu diziye "MMSS" eklemek + canActivate'e mmssComplete şartını geri koymak yeterli.
export const REQUIRED_DOC_TYPES = ["DIPLOMA"] as const;
export const ALL_DOC_TYPES = ["DIPLOMA", "MMSS", "CHAMBER", "STUDENT_CERT", "CERTIFICATE", "ACADEMIC"] as const;
export type DoctorDocType = (typeof ALL_DOC_TYPES)[number];

// ── İki aşamalı giriş — AŞAMA 1: Doctorium kapısı (v6.87; öğrenci damgası v6.95) ───────────────
// Tabip odası "Protokol Numaralı" üye yazısı (CHAMBER) yüklüyse Doctor.chamberLetterAt damgalanır
// (otomatik — admin onayı beklemez; kullanıcı kararı 2026-08-11). v6.95: tıp öğrencisi e-Devlet
// öğrenci belgesi (STUDENT_CERT) yükleyince Doctor.studentVerifiedAt aynı desenle damgalanır
// (kullanıcı kararı 2026-08-14). Doctorium erişimi damgalardan biri VEYA klinik aktivasyonla açılır.
// ⚠️ Parametre tipi ÜÇ alanı da zorunlu tutar (kasıtlı — deletionLockedAt/CaseRef deseni): çağıran
// select'ine studentVerifiedAt eklemeyi unutursa derleme kırılır, kapı sessizce yanlış karar vermez.

// Doctorium'a girebilir mi (saf — birim testlenebilir).
export function hasDoctoriumAccess(d: {
  chamberLetterAt: Date | null;
  activatedAt: Date | null;
  studentVerifiedAt: Date | null;
}): boolean {
  return !!d.chamberLetterAt || !!d.activatedAt || !!d.studentVerifiedAt;
}

// Tabip odası yazısı yüklü mü?
export function hasChamberLetter(docs: { type: string }[]): boolean {
  return docs.some((x) => x.type === "CHAMBER");
}

// Öğrenci belgesi yüklü mü?
export function hasStudentCert(docs: { type: string }[]): boolean {
  return docs.some((x) => x.type === "STUDENT_CERT");
}

// Öğrenci-SINIRLI üye mi: öğrenci damgası var ama klinik aktivasyon yok. Pazarlama yüzeyleri
// (sponsor kartı, anket, ödül puanı) bu üyeye KAPALIDIR — tıp öğrencisi sağlık meslek mensubu
// değildir; meslek-mensubuna-tanıtım rejimi ona uygulanamaz (kullanıcı kararı 2026-08-14).
// Mezuniyette zorunlu belgeler (v6.105'ten beri yalnız diploma) tamamlanıp activatedAt dolunca
// süzgeç kendiliğinden kalkar (damga silinmez).
export function isStudentOnly(d: { studentVerifiedAt: Date | null; activatedAt: Date | null }): boolean {
  return !!d.studentVerifiedAt && !d.activatedAt;
}

// Üniversite e-postası mı (destekleyici SİNYAL — kapı açmaz, arayüzde rozet olur; kanıt daima
// STUDENT_CERT belgesidir). .edu.tr nic.tr'ce yalnız akademik kuruma verilir (güçlü sinyal);
// .edu ABD, .ac.<cc> İngiltere/Japonya vb. Liste bilinçli dar: sinyal yanlış-pozitife kapı açmaz.
export function isEduEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domain.endsWith(".edu.tr") || domain.endsWith(".edu") || /\.ac\.[a-z]{2,3}$/.test(domain);
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
// doktor hiçbir vakaya erişemez") hizalanabilsin.
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

// Zorunlu belge dosyaları (REQUIRED_DOC_TYPES — v6.105'ten beri yalnız diploma) yüklü mü?
export function hasRequiredDocs(docs: { type: string }[]): boolean {
  const types = new Set(docs.map((x) => x.type));
  return REQUIRED_DOC_TYPES.every((t) => types.has(t));
}

// Hesap aktif edilebilir mi (damga atılabilir): zorunlu belgeler.
// v6.105: mmssComplete şartı KALKTI (MMSS ihtiyari). İmzadaki `mmss` parametresi bilinçli
// KORUNDU — çağıranlar (refreshActivation, onboarding) değişmeden çalışsın ve şartı geri
// koymak tek satır olsun. Kullanılmadığı için `_mmss` adıyla işaretlendi.
export function canActivate(docs: { type: string }[], _mmss: MmssMeta): boolean {
  return hasRequiredDocs(docs);
}

// Eksik zorunlu adımları döndür (UI'da yönlendirme metni için).
// v6.105: MMSS satırları çıkarıldı — ihtiyari bir belge "eksik zorunlu adım" olarak listelenemez.
export function missingSteps(docs: { type: string }[], _mmss: MmssMeta): string[] {
  const types = new Set(docs.map((x) => x.type));
  const out: string[] = [];
  if (!types.has("DIPLOMA")) out.push("Tıp diploması");
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

// Onboarding tamamlanabilir mi: zorunlu belgeler + ≥1 işlem + FHIR qualification + kimlik (branş/şehir).
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
    db.doctor.findUnique({
      where: { id: doctorId },
      select: { chamberLetterAt: true, activatedAt: true, studentVerifiedAt: true },
    }),
  ]);
  if (!doc) return false;
  const has = hasChamberLetter(docs);
  if (has && !doc.chamberLetterAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { chamberLetterAt: new Date() } });
  } else if (!has && doc.chamberLetterAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { chamberLetterAt: null } });
  }
  return hasDoctoriumAccess({
    chamberLetterAt: has ? new Date() : null,
    activatedAt: doc.activatedAt,
    studentVerifiedAt: doc.studentVerifiedAt,
  });
}

// DB-yan-etkili: STUDENT_CERT belgesinin varlığını Doctor.studentVerifiedAt damgasına eşitler
// (refreshChamberLetter deseninin eşleniği — belge yükleme/silme sonrası çağrılır; belge silinirse
// damga düşer). Döndürür: doktorun GÜNCEL Doctorium erişimi (herhangi bir damga VEYA aktivasyon).
export async function refreshStudentCert(doctorId: string): Promise<boolean> {
  const [docs, doc] = await Promise.all([
    db.doctorDocument.findMany({ where: { doctorId, type: "STUDENT_CERT" }, select: { type: true } }),
    db.doctor.findUnique({
      where: { id: doctorId },
      select: { chamberLetterAt: true, activatedAt: true, studentVerifiedAt: true },
    }),
  ]);
  if (!doc) return false;
  const has = hasStudentCert(docs);
  if (has && !doc.studentVerifiedAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { studentVerifiedAt: new Date() } });
  } else if (!has && doc.studentVerifiedAt) {
    await db.doctor.update({ where: { id: doctorId }, data: { studentVerifiedAt: null } });
  }
  return hasDoctoriumAccess({
    chamberLetterAt: doc.chamberLetterAt,
    activatedAt: doc.activatedAt,
    studentVerifiedAt: has ? new Date() : null,
  });
}
