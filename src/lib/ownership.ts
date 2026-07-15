// Hasta↔vaka erişim modeli — vaka-ataması bazlı scoping (T2, sıkı multi-tenant).
//
// Roller:
//   PATIENT     → yalnız KENDİ vakası (c.userId === user.id)
//   PARTNER     → hasta DB erişimi YOK (her zaman reddedilir)
//   COORDINATOR → operasyon (lojistik/rezervasyon) → geniş
//   ETHICS      → şikayet incelemesi (anonimleştirilmiş panel) → geniş
//   ADMIN       → yönetim → geniş
//   DOCTOR      → yalnız DOĞRULANMIŞ hekim VE (vaka kendisine atanmış: c.doctorId === doctor.id
//                 VEYA vaka atanmamış: c.doctorId === null VE vaka KENDİ BRANŞINDA → kuyruktan
//                 üstlenebilsin). Başka hekime ATANMIŞ vakayı VE yabancı-branş atanmamış vakayı
//                 OKUYAMAZ. Doğrulanmamış (self-signup) hekim hiçbir vakaya erişemez.
//
// Branş-daraltması (2026-07-03): atanmamış (kuyruk) vaka artık yalnız hekimin KENDİ branşındaki
// vakalara açık — kokpit UI'ı (doktor/page.tsx) v3.0'dan beri bu davranıştaydı, ownership/API katmanı
// hizalandı (savunma-derinliği; caseId bilen doktor yabancı-branş atanmamış vakanın PHI'sine erişemez).
// Nöbetçi/İcapçı/Ücretsiz-hizmet akışları ETKİLENMEZ: erişimleri hasta-tetikli (PATIENT dalı, branşsız) veya
// atomik atama-sonrası (c.doctorId set → "bana atanmış" dalı). Boş-branşlı hekim (Google-yolu onboarding
// tamamlanmamış) atanmamış vakalardan bilinçli fail-closed kesilir.
//
// Not: DOCTOR kararı hekim profili + doğrulama gerektirir → DB lookup → fonksiyon ASYNC. Senkron
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
import type { SessionUser } from "./session";

export type CaseRef = { userId: string | null; doctorId: string | null; branch: string; deletionLockedAt: Date | null };

// DOCTOR kullanıcısının hekim profili (id + doğrulama + branş). Atama eşleşmesi + doğrulama +
// branş-daraltması kapısı için. branch boş string ("") = onboarding tamamlanmamış → fail-closed.
async function doctorContext(user: SessionUser): Promise<{ doctorId: string | null; verified: boolean; branch: string }> {
  const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctorId = u?.doctorId ?? null;
  if (!doctorId) return { doctorId: null, verified: false, branch: "" };
  const d = await db.doctor.findUnique({ where: { id: doctorId }, select: { verified: true, branch: true } });
  return { doctorId, verified: !!d?.verified, branch: d?.branch ?? "" };
}

// Verilen kullanıcı bu vakaya erişebilir mi? (Tek doğruluk kaynağı.)
export async function canCaseBeAccessedBy(user: SessionUser | null, c: CaseRef): Promise<boolean> {
  if (!user) return false;
  // Hesap silme kilidi — HER ROLDEN ÖNCE. Hasta silinmesini istedi; kayıt yalnız yasal yükümlülük
  // gereği duruyor, kimsenin okuması için değil. Süre dolunca cron fiziken imha eder.
  if (deletionLocked(c)) return false;
  switch (user.role) {
    case "PATIENT":
      return c.userId === user.id;
    case "PARTNER":
      return false; // hasta veritabanına erişemez
    case "COORDINATOR":
    case "ETHICS":
    case "ADMIN":
      return true; // operasyon/governance/yönetim → geniş erişim
    case "DOCTOR": {
      const { doctorId, verified, branch } = await doctorContext(user);
      if (!verified || !doctorId) return false; // doğrulanmamış hekim → erişim yok
      if (c.doctorId === doctorId) return true; // bana atanmış
      // atanmamış (kuyruk) VE kendi branşım (boş-branş → fail-closed); yabancı-branş/başka-atanmış → yok
      return c.doctorId === null && !!branch && branch === c.branch;
    }
    default:
      return false;
  }
}

// Oturum kullanıcısı için kısayol (sayfalarda/route'larda user'ı ayrı çekmeye gerek yok).
export async function canAccessCase(c: CaseRef): Promise<boolean> {
  return canCaseBeAccessedBy(await getCurrentUser(), c);
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

export async function canAccessSecondOpinionCase(c: { patientId: string }): Promise<boolean> {
  return ownsSecondOpinionCase(await getCurrentUser(), c);
}

// İkinci Görüş HASTA-AKSİYON uçları (pay/fulfill/respond-video) — yalnız vaka sahibi hasta (T15b).
// Bu üç uç PHI OKUMAZ ama state-machine geçişi TETİKLER (ödeme simüle / talep FULFILLED / video randevu
// yanıtı). Gevşek `ownsSecondOpinionCase` her personele true dönerdi → yabancı doktor state-tamper
// yapabilirdi. Üçü de saf hasta aksiyonu olduğundan yalnız hastaya daraltıldı (personel dahil edilmez).
export function isSecondOpinionPatient(user: SessionUser | null, c: { patientId: string }): boolean {
  return !!user && user.role === "PATIENT" && c.patientId === user.id;
}

// İkinci Görüş vakası — DOKTOR-daraltmalı erişim (opinion route'undaki desenin tek-kaynak hali):
// DOCTOR yalnız DOĞRULANMIŞ hekim VE vaka KENDİSİNE atanmışsa (c.assignedDoctorId === doctorId) erişir.
// Atanmamış SO vakasına doktor erişemez — önce üstlenmeli/atanmalı (accept=claim veya koordinatör assign);
// üstlenince assignedDoctorId set olur → erişim açılır. Diğer roller temel kurala (ownsSecondOpinionCase)
// tabidir. assignedDoctorId ZORUNLU → seçmeyen sorgu derlemede patlar.
export type SoCaseRef = { patientId: string; assignedDoctorId: string | null; deletionLockedAt: Date | null };

export async function canSoCaseBeAccessedBy(user: SessionUser | null, c: SoCaseRef): Promise<boolean> {
  if (!user) return false;
  if (deletionLocked(c)) return false; // hesap silme kilidi — her rolden önce (bkz. canCaseBeAccessedBy)
  if (user.role === "DOCTOR") {
    const { doctorId, verified } = await doctorContext(user);
    return verified && !!doctorId && c.assignedDoctorId === doctorId;
  }
  return ownsSecondOpinionCase(user, c);
}
