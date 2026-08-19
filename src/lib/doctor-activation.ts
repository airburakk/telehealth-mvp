// M5 — Doktor hesap aktivasyon kapısı.
// Zorunlu mesleki belge (v6.105'ten beri YALNIZ Tıp Diploması — aşağıdaki karar notu) yüklenip
// 🔴 DOĞRULANMADAN doktor klinik panellere erişemez (v6.119 sıkılaşması: eskiden yüklemek yeterdi).
// Koşul sağlanınca Doctor.activatedAt damgalanır; eksilirse damga geri alınır (gate yeniden devreye
// girer). Doğrulama iki yoldan gelir — e-Devlet barkodu otomatik (lib/edevlet-belge.ts, DIŞ İSTEK
// YOK) veya incelemeci onayı. Tam gerekçe: vault wiki/kavramlar/doktor-kimlik-dogrulama.md. MMSS (Mesleki Mali Sorumluluk Sigortası)
// İHTİYARİ: yüklenirse teminat limiti M3 Katman 3 malpraktis ek-prim hesabının girdisidir.
import { db } from "@/lib/db";

// Hesap aktivasyonu için yüklenmesi ZORUNLU belge tipleri (sertifika/akademik ihtiyari).
// ⚠️ STUDENT_CERT buraya EKLENMEZ: Aşama 1'in (Doctorium) öğrenci belgesidir, klinik aktivasyonun
// (Aşama 2) girdisi değildir — kapılar birbirinden bağımsız damgalanır.
// 🪦 CHAMBER v6.124'te LİSTEDEN ÇIKTI (kullanıcı kararı 2026-08-19 "Yalnız e-Devlet diploma"):
// tabip odası yazısı artık ne yüklenebilir ne Doctorium açar; eski satırlar tarihsel kayıttır.
// v6.105 (kullanıcı kararı 2026-08-17): MMSS aktivasyon şartından ÇIKARILDI ("şimdilik kaldıralım")
// → tek zorunlu mesleki belge Tıp Diploması. MMSS kartı/formu İHTİYARİ olarak DURUYOR: yükleyen
// doktorun teminat limiti kaydedilmeye devam eder ve /paket sigorta paketini (M3 Katman 3) besler.
// ⚠️ Bu kapı GEVŞEME'dir, sıkılaşma değil → mevcut aktif doktorlar etkilenmez (aksi yönde olsaydı
// "Ders 1" regresyonu doğardı). Yan etki KASITLI: diploması olup MMSS'si olmadığı için bekleyen
// doktorlar, bir sonraki refreshActivation'da aktifleşir.
// 🔙 Geri alma: bu diziye "MMSS" eklemek + canActivate'e mmssComplete şartını geri koymak yeterli.
export const REQUIRED_DOC_TYPES = ["DIPLOMA"] as const;
export const ALL_DOC_TYPES = ["DIPLOMA", "MMSS", "STUDENT_CERT", "CERTIFICATE", "ACADEMIC"] as const;
export type DoctorDocType = (typeof ALL_DOC_TYPES)[number];

// ── İki aşamalı giriş — AŞAMA 1: Doctorium kapısı (v6.124 yeniden tasarım) ─────────────────────
// 🔴 v6.124 (kullanıcı kararı 2026-08-19, Doximity araştırması sonrası): Doctorium'un TEK doktor
// yolu e-DEVLET DOĞRULAMALI DİPLOMA'dır — DIPLOMA belgesi ACCEPTED olunca Doctor.diplomaVerifiedAt
// damgalanır (refreshActivation eşitler). Tabip odası yazısı (CHAMBER/chamberLetterAt) KAPIDAN
// DÜŞTÜ; v6.87-123 arası kuralın tarihi schema.prisma'daki kolon yorumundadır. Öğrenci yolu
// (studentVerifiedAt, v6.95) AYNEN sürer. activatedAt kapıda ayrıca OKUNMAZ: klinik aktivasyon
// zaten ACCEPTED diploma ister → activatedAt ⊂ diplomaVerifiedAt (migration backfill'i kurdu).
// ⚠️ Parametre tipi İKİ alanı da zorunlu tutar (kasıtlı — deletionLockedAt/CaseRef deseni): çağıran
// select'ine alan eklemeyi unutursa derleme kırılır, kapı sessizce yanlış karar vermez.

// Doctorium'a girebilir mi (saf — birim testlenebilir).
export function hasDoctoriumAccess(d: {
  diplomaVerifiedAt: Date | null;
  studentVerifiedAt: Date | null;
}): boolean {
  return !!d.diplomaVerifiedAt || !!d.studentVerifiedAt;
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

// Zorunlu belge dosyaları (REQUIRED_DOC_TYPES — v6.105'ten beri yalnız diploma) YÜKLÜ mü?
// ⚠️ Bu VARLIK sorusudur, onay sorusu DEĞİL — onboarding'i tamamlamanın şartıdır (doktor belgesini
// yükleyince onboarding biter; klinik kapı ayrıca ONAY ister → canActivate). İkisini karıştırma:
// hasRequiredDocs'u klinik kapı olarak kullanmak v6.119 sıkılaşmasını sessizce geri alır.
export function hasRequiredDocs(docs: { type: string }[]): boolean {
  const types = new Set(docs.map((x) => x.type));
  return REQUIRED_DOC_TYPES.every((t) => types.has(t));
}

// Zorunlu belgelerin hepsi ONAYLI mı (v6.119)?
// ⚠️ Parametre tipi `status`ü ZORUNLU tutar (kasıtlı — deletionLockedAt/CaseRef deseni): çağıran
// select'ine status eklemeyi unutursa DERLEME KIRILIR, kapı sessizce "onaysız da geçer"e dönmez.
export function hasAcceptedRequiredDocs(docs: { type: string; status: string }[]): boolean {
  return REQUIRED_DOC_TYPES.every((t) => docs.some((d) => d.type === t && d.status === "ACCEPTED"));
}

/** Aşama 2 güvenlik katmanı damgaları (v6.126 — lib/doctor-verify.ts hasStage2Layers girdisi). */
export type LayerStamps = {
  smsVerifiedAt: Date | null;
  workEmailVerifiedAt: Date | null;
  clinicPhoneVerifiedAt: Date | null;
};

// Hesap aktif edilebilir mi (damga atılabilir): ONAYLI zorunlu belge (+ gate açıksa katmanlar).
// 🔴 v6.119 (kullanıcı kararı 2026-08-19): belge VARLIĞI yetmez, ACCEPTED olması gerekir.
// ACCEPTED iki yoldan gelir: (a) e-Devlet barkod okuması otomatik geçti (lib/edevlet-belge.ts —
// dış istek YOK) · (b) incelemeci /admin/doktor-onay'dan onayladı. Çoğu doktor (a) ile hiç beklemez.
// 🟡 v6.126: üçüncü parametre AŞAMA 2 katman kapısı (SMS zorunlu + kurum bağından biri — §8.2).
// `layerGate.enabled=false` (AURA_LAYER_GATE kapalı, VARSAYILAN) iken v6.124 davranışı birebir
// sürer; çağıranın parametreyi HİÇ vermemesi de aynı anlama gelir (dormant güvenli varsayılan).
// v6.105: mmssComplete şartı KALKTI (MMSS ihtiyari). İmzadaki `mmss` parametresi bilinçli KORUNDU.
// 🔙 Geri alma (kapıyı gevşetmek): gövdeyi `hasRequiredDocs(docs)`e çevirmek yeterli.
export function canActivate(
  docs: { type: string; status: string }[],
  _mmss: MmssMeta,
  layerGate?: { enabled: boolean; layers: LayerStamps },
): boolean {
  if (!hasAcceptedRequiredDocs(docs)) return false;
  if (layerGate?.enabled) {
    const L = layerGate.layers;
    return !!L.smsVerifiedAt && (!!L.workEmailVerifiedAt || !!L.clinicPhoneVerifiedAt);
  }
  return true;
}

// Eksik zorunlu adımları döndür (UI'da yönlendirme metni için) — VARLIK bazlı.
// v6.105: MMSS satırları çıkarıldı — ihtiyari bir belge "eksik zorunlu adım" olarak listelenemez.
// ⚠️ v6.119: burası ONAY durumuna BAKMAZ (bilinçli) — "diploman eksik" ile "diploman incelemede"
// farklı mesajlardır; ikincisi activationState() ile anlatılır, yoksa doktor yüklediği belgeyi
// durmadan yeniden yüklemeye çalışır.
export function missingSteps(docs: { type: string }[], _mmss: MmssMeta): string[] {
  const types = new Set(docs.map((x) => x.type));
  const out: string[] = [];
  if (!types.has("DIPLOMA")) out.push("Tıp diploması");
  return out;
}

/** Doktorun klinik aktivasyonunun UI'da anlatılacak hâli (v6.119). */
export type ActivationState = "MISSING" | "PENDING_REVIEW" | "REJECTED" | "ACTIVE";

// Zorunlu belgenin (diploma) durumundan UI mesaj hâlini türetir (saf).
// MISSING = hiç yüklenmedi · PENDING_REVIEW = yüklendi, henüz doğrulanmadı · REJECTED = yetersiz
// bulundu · ACTIVE = onaylı. REJECTED, PENDING'e göre ÖNCELİKLİ: doktor "inceleniyor" sanıp
// boşuna beklememeli, yeniden yüklemesi gerektiğini görmeli.
export function activationState(docs: { type: string; status: string }[]): ActivationState {
  const diplomas = docs.filter((d) => d.type === "DIPLOMA");
  if (diplomas.length === 0) return "MISSING";
  if (diplomas.some((d) => d.status === "ACCEPTED")) return "ACTIVE";
  if (diplomas.some((d) => d.status === "REJECTED")) return "REJECTED";
  return "PENDING_REVIEW";
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

// Onboarding tamamlanabilir mi: zorunlu belgeler YÜKLÜ + ≥1 işlem + FHIR qualification + kimlik.
// 🔴 v6.119: burada canActivate DEĞİL hasRequiredDocs kullanılır (bilinçli ayrım). Aksi hâlde
// doktor, diploması insan incelemesinden geçene kadar onboarding'i BİTİREMEZ ve kayıt akışında
// asılı kalırdı. Onboarding "belgeni yükledin mi", klinik kapı "belgen doğrulandı mı" sorar.
export function canCompleteOnboarding(docs: { type: string }[], d: OnboardingData): boolean {
  return hasRequiredDocs(docs) && hasProcedures(d.procedures) && hasQualification(d) && !!d.branch.trim() && !!d.city.trim();
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

// DB-yan-etkili: belgeleri okuyup İKİ damgayı eşitler (v6.124):
//   diplomaVerifiedAt — DIPLOMA ACCEPTED (Aşama 1 / Doctorium kapısı)
//   activatedAt       — canActivate (Aşama 2 / klinik; bugün = aynı koşul, §8.2 katmanları inince
//                        SMS OTP + kurum bağı da eklenecek — o gün YALNIZ canActivate değişir)
// Belge yükleme / silme / inceleme kararı sonrası çağrılır. Koşul sağlanınca damga atar,
// bozulunca kaldırır. Döndürür: hesap şu an KLİNİK-aktif mi (Doctorium durumu refreshStudentCert
// dönüşünden okunur — mevcut çağıran sözleşmesi).
export async function refreshActivation(doctorId: string): Promise<boolean> {
  const [docs, doc] = await Promise.all([
    // v6.119: status ŞART — canActivate onaylı belge ister (tip imzası bunu derlemede zorlar).
    db.doctorDocument.findMany({ where: { doctorId }, select: { type: true, status: true } }),
    db.doctor.findUnique({
      where: { id: doctorId },
      select: {
        mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, activatedAt: true, diplomaVerifiedAt: true,
        // v6.126 — Aşama 2 katman damgaları (yalnız AURA_LAYER_GATE=1 iken karara girer)
        smsVerifiedAt: true, workEmailVerifiedAt: true, clinicPhoneVerifiedAt: true,
      },
    }),
  ]);
  if (!doc) return false;
  const diplomaOk = hasAcceptedRequiredDocs(docs);
  const ok = canActivate(docs, doc, { enabled: process.env.AURA_LAYER_GATE === "1", layers: doc });
  const data: { activatedAt?: Date | null; diplomaVerifiedAt?: Date | null } = {};
  if (diplomaOk && !doc.diplomaVerifiedAt) data.diplomaVerifiedAt = new Date();
  else if (!diplomaOk && doc.diplomaVerifiedAt) data.diplomaVerifiedAt = null;
  if (ok && !doc.activatedAt) data.activatedAt = new Date();
  else if (!ok && doc.activatedAt) data.activatedAt = null;
  if (Object.keys(data).length > 0) {
    await db.doctor.update({ where: { id: doctorId }, data });
  }
  return ok;
}

// 🪦 refreshChamberLetter v6.124'te SİLİNDİ (CHAMBER kapıdan düştü — dosya başındaki karar notu).
// chamberLetterAt kolonu tarihsel; hiçbir akış artık onu damgalamaz/okumaz.

// DB-yan-etkili: STUDENT_CERT belgesinin varlığını Doctor.studentVerifiedAt damgasına eşitler
// (refreshActivation deseni — belge yükleme/silme sonrası çağrılır; belge silinirse damga düşer).
// Döndürür: doktorun GÜNCEL Doctorium erişimi (diploma doğrulaması VEYA öğrenci damgası).
// ⚠️ refreshActivation'dan SONRA çağrılmalı (mevcut sözleşme) — diplomaVerifiedAt'in güncel
// hâlini okur; önce çağrılırsa bir tur bayat karar döndürür.
export async function refreshStudentCert(doctorId: string): Promise<boolean> {
  const [docs, doc] = await Promise.all([
    db.doctorDocument.findMany({ where: { doctorId, type: "STUDENT_CERT" }, select: { type: true } }),
    db.doctor.findUnique({
      where: { id: doctorId },
      select: { diplomaVerifiedAt: true, studentVerifiedAt: true },
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
    diplomaVerifiedAt: doc.diplomaVerifiedAt,
    studentVerifiedAt: has ? new Date() : null,
  });
}
