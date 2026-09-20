// Hasta↔vaka erişim modeli — vaka-ataması bazlı scoping (T2, sıkı multi-tenant).
//
// Roller:
//   PATIENT     → yalnız KENDİ vakası (c.userId === user.id)
//   PARTNER     → hasta DB erişimi YOK (her zaman reddedilir)
//   HEALTH_PRO  → klinik yetki YOK (2026-08-12 kullanıcı kararı) → `default: false` dalına düşer;
//                 ileride yetki tanımlanırsa BURADA açık dal yazılır (sessizce genişletme yok)
//   COORDINATOR → operasyon (lojistik/rezervasyon) → geniş
//   ETHICS      → şikayet incelemesi (anonimleştirilmiş panel) → geniş
//   ADMIN       → yönetim → geniş
//   DOCTOR      → yalnız DOĞRULANMIŞ + klinik-aktive doktor. Vaka kendisine atanmış (c.doctorId === doctor.id) → TAM;
//                 vaka atanmamış (c.doctorId === null) VE KENDİ BRANŞINDA → yalnız KİMLİKSİZ ÖNİZLEME ("preview";
//                 K06 1C-a, 2026-09-20 — personel metni A09 madde 10.1: "atanmamış başvuruları yalnız kimliksiz
//                 önizlemeyle görürsünüz"; kabul = POST /api/cases/[id]/accept → atama → tam). Başka doktora
//                 ATANMIŞ vakayı VE yabancı-branş atanmamış vakayı hiç göremez. Doğrulanmamış (self-signup) doktor
//                 hiçbir vakaya erişemez.
//
// Branş-daraltması (2026-07-03): atanmamış (kuyruk) vaka artık yalnız doktorun KENDİ branşındaki
// vakalara açık — kokpit UI'ı (doktor/page.tsx) v3.0'dan beri bu davranıştaydı, ownership/API katmanı
// hizalandı (savunma-derinliği; caseId bilen doktor yabancı-branş atanmamış vakanın PHI'sine erişemez).
// Nöbetçi/İcapçı/Ücretsiz-hizmet akışları ETKİLENMEZ: erişimleri hasta-tetikli (PATIENT dalı, branşsız) veya
// atomik atama-sonrası (c.doctorId set → "bana atanmış" dalı). Boş-branşlı doktor (Google-yolu onboarding
// tamamlanmamış) atanmamış vakalardan bilinçli fail-closed kesilir.
//
// Not: DOCTOR kararı doktor profili + doğrulama gerektirir → DB lookup → fonksiyon ASYNC. Senkron
// `ownsCase` bilerek KALDIRILDI (bir çağrı yerinde `await` unutmak fail-open yaratırdı). CaseRef.doctorId
// VE CaseRef.branch ZORUNLU: seçmeyen sorgu derlemede hata verir → fail-open yerine compile-error.
//
// HESAP SİLME KİLİDİ (v6.11): hasta hesabını silince klinik kayıt yasal saklama süresi boyunca durur
// ama HERKESE kapanır (hasta, doktor, koordinatör, ADMIN dahil). Kilit rol kontrolünden ÖNCE uygulanır —
// aksi halde ADMIN/COORDINATOR/ETHICS geniş dalları kilidi delerdi. `deletionLockedAt` CaseRef'te
// ZORUNLU: seçmeyen sorgu DERLEMEDE patlar → fail-open yerine compile-error (doctorId/branch deseni).
import { getCurrentUser } from "./auth";
import { db } from "./db";
import { deletionLocked } from "./account-deletion";
import { hasClinicalAccess } from "./doctor-activation";
import type { SessionUser } from "./session";

export type CaseRef = { userId: string | null; doctorId: string | null; branch: string; deletionLockedAt: Date | null };

// DOCTOR kullanıcısının doktor profili (id + doğrulama + aktivasyon + branş). Atama eşleşmesi +
// doğrulama + branş-daraltması kapısı için. branch boş string ("") = onboarding tamamlanmamış →
// fail-closed. v6.87: `activated` (Aşama 2 — hasClinicalAccess) eklendi; klinik aktivasyonu
// düşen (belge silinen) veya hiç tamamlamayan doktor vaka verisine API'den de erişemez —
// sayfa kapılarının ownership eşleniği (iki katman bağımsız fail-closed).
async function doctorContext(
  user: SessionUser,
): Promise<{ doctorId: string | null; verified: boolean; activated: boolean; branch: string }> {
  const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctorId = u?.doctorId ?? null;
  if (!doctorId) return { doctorId: null, verified: false, activated: false, branch: "" };
  const d = await db.doctor.findUnique({
    where: { id: doctorId },
    select: { verified: true, branch: true, activatedAt: true },
  });
  return { doctorId, verified: !!d?.verified, activated: !!d && hasClinicalAccess(d), branch: d?.branch ?? "" };
}

// ── ERİŞİM SEVİYESİ (K06 1C-a, 2026-09-20 — kontrol raporu: yayımlanan taahhüt ↔ fiilî politika) ─────────────────
//   "full"    → klinik içerik (kimlik, telefon, belgeler, triyaj yanıtları, notlar, epikriz)
//   "preview" → KİMLİKSİZ havuz önizlemesi (lib/case-preview casePreviewDto: branş/aciliyet/ülke/dil/tarih + adı maskeli
//               şikâyet + dosya SAYISI; ad/kimlik/telefon/belge/triyaj yanıtı/AI gerekçesi YOK) — yalnız aynı branştaki
//               ATANMAMIŞ vakada, yalnız DOCTOR
//   "none"    → hiç
// `canCaseBeAccessedBy` = yalnız "full": 38 çağrı noktası (belge/DICOM/lab/kodlama/AI/FHIR/görüşme/işlem uçları) havuz
// vakasında otomatik fail-closed kalır; önizlemeyi yalnız İKİ yüzey çizer (doktor/vaka/[id] sayfası + GET api/cases/[id])
// ve ikisi de bu fonksiyona bakar. Kabul (POST api/cases/[id]/accept) = atama → seviye "full".
// 1C-b (koordinatör/yönetici/Etik Kurul klinik içerik) AYRI pakettir — burada geniş dal korunur.
export type CaseAccessLevel = "none" | "preview" | "full";

export async function caseAccessLevel(user: SessionUser | null, c: CaseRef): Promise<CaseAccessLevel> {
  if (!user) return "none";
  // Hesap silme kilidi — HER ROLDEN ÖNCE. Hasta silinmesini istedi; kayıt yalnız yasal yükümlülük
  // gereği duruyor, kimsenin okuması için değil. Süre dolunca cron fiziken imha eder.
  if (deletionLocked(c)) return "none";
  switch (user.role) {
    case "PATIENT":
      return c.userId === user.id ? "full" : "none";
    case "PARTNER":
      return "none"; // hasta veritabanına erişemez
    case "COORDINATOR":
    case "ETHICS":
    case "ADMIN":
      return "full"; // operasyon/governance/yönetim → geniş erişim (1C-b bu dalı daraltacak)
    case "DOCTOR": {
      const { doctorId, verified, activated, branch } = await doctorContext(user);
      if (!verified || !activated || !doctorId) return "none"; // doğrulanmamış VEYA aktivasyonsuz (Aşama 2'siz) doktor → erişim yok
      if (c.doctorId === doctorId) return "full"; // bana atanmış
      // atanmamış (havuz) VE kendi branşım (boş-branş → fail-closed) → yalnız kimliksiz önizleme; yabancı-branş/başka-atanmış → yok
      return c.doctorId === null && !!branch && branch === c.branch ? "preview" : "none";
    }
    default:
      return "none";
  }
}

// Verilen kullanıcı bu vakanın KLİNİK İÇERİĞİNE erişebilir mi? (Tek doğruluk kaynağı = caseAccessLevel; yalnız "full".)
// Havuzdaki atanmamış vaka için false döner — önizleme isteyen yüzey caseAccessLevel'a bakar.
export async function canCaseBeAccessedBy(user: SessionUser | null, c: CaseRef): Promise<boolean> {
  return (await caseAccessLevel(user, c)) === "full";
}

// Oturum kullanıcısı için kısayol (sayfalarda/route'larda user'ı ayrı çekmeye gerek yok).
export async function canAccessCase(c: CaseRef): Promise<boolean> {
  return canCaseBeAccessedBy(await getCurrentUser(), c);
}

// ── GÖRÜŞME BAŞLATMA — YAZMA yetkisi, okuma kapısından AYRI (kontrol raporu 2026-09-19 D03) ────────
// POST /api/cases/[id]/consult eskiden `canCaseBeAccessedBy` (OKUMA) ile korunuyordu: kendi vakasını okuyan
// hasta da, aynı branştaki herhangi bir doktor da yeni görüşme AÇABİLİYORDU; tamamlanmış (DONE) vaka
// yeniden IN_CONSULT'a yazılabiliyordu; atanmamış vakaya "ilk doğrulanmış doktor" (yabancı branş dahil)
// atanıyordu. "Kim YAPAR" sorusu burada ayrı yanıtlanır; durum makinesi + post-op kapısı route'ta uygulanır.
export type ConsultStartRef = CaseRef & { status: string };
export type ConsultStartVerdict =
  | { ok: true; doctorId: string; assigned: "existing" | "self" }
  | { ok: false; status: 403 | 409; error: string };

const NO_ACCESS = "Bu vakaya erişim yetkiniz yok.";

export async function canStartConsultation(user: SessionUser | null, c: ConsultStartRef): Promise<ConsultStartVerdict> {
  if (!user) return { ok: false, status: 403, error: NO_ACCESS };
  if (deletionLocked(c)) return { ok: false, status: 403, error: NO_ACCESS }; // silme kilidi her rolden önce
  switch (user.role) {
    case "PATIENT": {
      // Hasta yalnız KENDİ vakasında ve yalnız ATANMIŞ doktorla katılır (randevu kabulü / nöbetçi kapısı
      // Case.doctorId'yi yazar — clinical-duty). Hasta doktor SEÇEMEZ; atama yoksa görüşme açılamaz.
      if (c.userId !== user.id) return { ok: false, status: 403, error: NO_ACCESS };
      if (!c.doctorId) return { ok: false, status: 409, error: "Görüşme için önce doktor ataması (randevu onayı veya nöbetçi doktor) gerekir." };
      return { ok: true, doctorId: c.doctorId, assigned: "existing" };
    }
    case "DOCTOR": {
      const { doctorId, verified, activated, branch } = await doctorContext(user);
      if (!verified || !activated || !doctorId) return { ok: false, status: 403, error: "Klinik aktivasyonunuz tamamlanmadan görüşme başlatamazsınız." };
      if (c.doctorId) {
        if (c.doctorId !== doctorId) return { ok: false, status: 403, error: "Bu vaka başka bir doktora atanmış." };
        return { ok: true, doctorId, assigned: "existing" };
      }
      // Atanmamış havuz vakası: yalnız KENDİ branşı; üstlenme = atama ("kabul ettiğiniz" — personel metni 10.1).
      if (!branch || branch !== c.branch) return { ok: false, status: 403, error: "Bu vaka branşınızın havuzunda değil." };
      return { ok: true, doctorId, assigned: "self" };
    }
    case "COORDINATOR":
    case "ADMIN": {
      // Operasyon/yönetim doktor SEÇMEZ: yalnız atanmış doktoru olan vakada görüşmeyi açabilir.
      if (!c.doctorId) return { ok: false, status: 409, error: "Atanmış doktor yok — önce atama yapılmalı." };
      return { ok: true, doctorId: c.doctorId, assigned: "existing" };
    }
    default:
      return { ok: false, status: 403, error: NO_ACCESS }; // ETHICS/PARTNER/AGENCY/HEALTH_PRO → görüşme açamaz
  }
}

// ── HASTA BEYANI uçları — OKUMA yetkisinden AYRI (2026-08-03 dış denetimi) ───────────────────────
// `canAccessCase` bir OKUMA kapısıdır: koordinatör/etik/admin ve atanmış (hatta aynı branştaki
// atanmamış) doktor true alır. Post-op check-in ve şikayet uçları bu kapıyı kullanıyordu → hasta
// ADINA ağrı/ateş/not/fotoğraf kaydı veya Etik Kurul şikayeti OLUŞTURULABİLİYORDU.
//
// Bu bir ifşa değil, ATFEDİLEBİLİRLİK sorunudur: klinik kayda "hastanın beyanı" olarak giren veriyi
// hasta dışında biri üretebiliyorsa kaydın delil değeri düşer. Kullanıcı kararı (2026-08-03):
// bu iki uç YALNIZ hastanın kendisine açıktır — koordinatör telefonla alınan bilgiyi giremez.
//
// KURAL: yeni bir uç yazarken "bunu kim YAPAR" ile "bunu kim GÖRÜR" sorularını ayrı sor;
// yazma/eylem uçlarında amaç-bazlı fonksiyon kullan, okuma kapısını ödünç alma.
export function isCasePatient(user: SessionUser | null, c: CaseRef): boolean {
  if (!user || user.role !== "PATIENT") return false;
  if (deletionLocked(c)) return false; // silme kilidi her rolden önce
  return c.userId != null && c.userId === user.id;
}

/** Oturum kullanıcısı bu vakanın HASTASI mı? (hasta-beyanı uçları için kısayol) */
export async function isCurrentUserCasePatient(c: CaseRef): Promise<boolean> {
  return isCasePatient(await getCurrentUser(), c);
}

// İkinci Görüş vakası sahipliği (spec §8) — TEMEL kural. PATIENT yalnız kendi vakasına; klinik
// personel (doktor/koordinatör/etik/admin) temel düzeyde erişir; DİĞER HER ROL fail-closed reddedilir.
// ⚠️ DOCTOR burada DARALTILMAZ (her doktora true döner) → PHI taşıyan uçlarda TEK BAŞINA KULLANMA;
// atama-daraltmalı `canSoCaseBeAccessedBy` kullan (BOLA düzeltmesi 2026-07-02).
// Fail-closed (2026-07-12): eski `else → true` PARTNER dışı HER rolü personel sayıyordu → AGENCY
// (hasta DB erişimi YOK, klinik değil) + malformed/tanınmayan rol SO belgelerine/PHI'ye erişebiliyordu.
// Artık açık allow-list; AGENCY/PARTNER/bilinmeyen → false. (getCurrentUser zaten malformed rolü eler.)
const SO_CLINICAL_STAFF: readonly SessionUser["role"][] = ["DOCTOR", "COORDINATOR", "ETHICS", "ADMIN"];
export function ownsSecondOpinionCase(user: SessionUser | null, c: { patientId: string }): boolean {
  if (!user) return false;
  if (user.role === "PATIENT") return c.patientId === user.id;
  return SO_CLINICAL_STAFF.includes(user.role); // PARTNER/AGENCY/tanınmayan → fail-closed
}

// NOT (denetim #22): eski gevşek `canAccessSecondOpinionCase` SİLİNDİ — atama-bazlı
// `canSoCaseBeAccessedBy` (api-auth) canlı kapıdır; gevşek varyantın yeniden bağlanma riski kalksın.

// İkinci Görüş HASTA-AKSİYON uçları (pay/fulfill/respond-video) — yalnız vaka sahibi hasta (T15b).
// Bu üç uç PHI OKUMAZ ama state-machine geçişi TETİKLER (ödeme simüle / talep FULFILLED / video randevu
// yanıtı). Gevşek `ownsSecondOpinionCase` her personele true dönerdi → yabancı doktor state-tamper
// yapabilirdi. Üçü de saf hasta aksiyonu olduğundan yalnız hastaya daraltıldı (personel dahil edilmez).
export function isSecondOpinionPatient(user: SessionUser | null, c: { patientId: string }): boolean {
  return !!user && user.role === "PATIENT" && c.patientId === user.id;
}

// İkinci Görüş vakası — DOKTOR-daraltmalı erişim (opinion route'undaki desenin tek-kaynak hali):
// DOCTOR yalnız DOĞRULANMIŞ doktor VE vaka KENDİSİNE atanmışsa (c.assignedDoctorId === doctorId) erişir.
// Atanmamış SO vakasına doktor erişemez — önce üstlenmeli/atanmalı (accept=claim veya koordinatör assign);
// üstlenince assignedDoctorId set olur → erişim açılır. Diğer roller temel kurala (ownsSecondOpinionCase)
// tabidir. assignedDoctorId ZORUNLU → seçmeyen sorgu derlemede patlar.
export type SoCaseRef = { patientId: string; assignedDoctorId: string | null; deletionLockedAt: Date | null };

export async function canSoCaseBeAccessedBy(user: SessionUser | null, c: SoCaseRef): Promise<boolean> {
  if (!user) return false;
  if (deletionLocked(c)) return false; // hesap silme kilidi — her rolden önce (bkz. canCaseBeAccessedBy)
  if (user.role === "DOCTOR") {
    const { doctorId, verified, activated } = await doctorContext(user);
    return verified && activated && !!doctorId && c.assignedDoctorId === doctorId;
  }
  return ownsSecondOpinionCase(user, c);
}

// ── İkinci Görüş LİSTE (koleksiyon) kapısı — canSoCaseBeAccessedBy'ın ÇOĞUL karşılığı ────────────
// NEDEN AYRI BİR FONKSİYON: nesne-düzeyi kapı tek vakayı alır; liste ucu vaka almadan ÖNCE sorguyu
// daraltmak zorundadır. 2026-08-03 dış denetimi, liste ucunun (`GET /api/second-opinion/cases`)
// `where: {}` ile PATIENT dışı HER role — PARTNER, AGENCY ve DOĞRULANMAMIŞ self-signup doktor dahil —
// 100 vakanın tanı özetini döndürdüğünü buldu. T14/T15 BOLA süpürmeleri yalnız `[id]` alt rotalarına
// bakmıştı; koleksiyon uçları o taramanın kör noktasıydı.
//
// DEĞİŞMEZ KURAL: liste ucu, nesne-düzeyi kapıdan DAHA GENİŞ veri döndüremez. Yeni bir SO liste/sayım
// sorgusu yazarken bu fonksiyonu kullan; elle `where` kurma.
// null dönerse → çağıran 403 döndürür (fail-closed; boş liste DEĞİL — yetkisizlik ile "vakan yok" ayrı şeyler).
export type SoListScope = { patientId?: string; assignedDoctorId?: string; deletionLockedAt: null };

export async function soCaseListScope(user: SessionUser | null): Promise<SoListScope | null> {
  if (!user) return null;
  // Silme kilidi sorgunun İÇİNDE: kilitli vaka hiçbir listede görünmez (nesne kapısındaki
  // `deletionLocked` erken-dönüşünün sorgu karşılığı).
  switch (user.role) {
    case "PATIENT":
      return { patientId: user.id, deletionLockedAt: null };
    case "DOCTOR": {
      const { doctorId, verified, activated } = await doctorContext(user);
      if (!verified || !activated || !doctorId) return null; // doğrulanmamış/aktivasyonsuz/profilsiz doktor → hiçbir şey
      return { assignedDoctorId: doctorId, deletionLockedAt: null }; // yalnız kendisine atanmışlar
    }
    case "COORDINATOR":
    case "ETHICS":
    case "ADMIN":
      return { deletionLockedAt: null }; // operasyon/governance/yönetim → geniş (kilitliler hariç)
    default:
      return null; // PARTNER / AGENCY / tanınmayan → fail-closed
  }
}
