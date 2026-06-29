// Hasta↔vaka erişim modeli — vaka-ataması bazlı scoping (T2, sıkı multi-tenant).
//
// Roller:
//   PATIENT     → yalnız KENDİ vakası (c.userId === user.id)
//   PARTNER     → hasta DB erişimi YOK (her zaman reddedilir)
//   COORDINATOR → operasyon (lojistik/rezervasyon) → geniş
//   ETHICS      → şikayet incelemesi (anonimleştirilmiş panel) → geniş
//   ADMIN       → yönetim → geniş
//   DOCTOR      → yalnız DOĞRULANMIŞ hekim VE (vaka kendisine atanmış: c.doctorId === doctor.id
//                 VEYA vaka atanmamış: c.doctorId === null → kuyruktan üstlenebilsin). Başka hekime
//                 ATANMIŞ vakayı OKUYAMAZ. Doğrulanmamış (self-signup) hekim hiçbir vakaya erişemez.
//
// Not: DOCTOR kararı hekim profili + doğrulama gerektirir → DB lookup → fonksiyon ASYNC. Senkron
// `ownsCase` bilerek KALDIRILDI (bir çağrı yerinde `await` unutmak fail-open yaratırdı). CaseRef.doctorId
// ZORUNLU (string | null): seçmeyen sorgu derlemede hata verir → fail-open yerine compile-error.
import { getCurrentUser } from "./auth";
import { db } from "./db";
import type { SessionUser } from "./session";

export type CaseRef = { userId: string | null; doctorId: string | null };

// DOCTOR kullanıcısının hekim profili (id + doğrulama). Atama eşleşmesi + doğrulama kapısı için.
async function doctorContext(user: SessionUser): Promise<{ doctorId: string | null; verified: boolean }> {
  const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctorId = u?.doctorId ?? null;
  if (!doctorId) return { doctorId: null, verified: false };
  const d = await db.doctor.findUnique({ where: { id: doctorId }, select: { verified: true } });
  return { doctorId, verified: !!d?.verified };
}

// Verilen kullanıcı bu vakaya erişebilir mi? (Tek doğruluk kaynağı.)
export async function canCaseBeAccessedBy(user: SessionUser | null, c: CaseRef): Promise<boolean> {
  if (!user) return false;
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
      const { doctorId, verified } = await doctorContext(user);
      if (!verified || !doctorId) return false; // doğrulanmamış hekim → erişim yok
      return c.doctorId === null || c.doctorId === doctorId; // atanmamış (kuyruk) VEYA bana atanmış
    }
    default:
      return false;
  }
}

// Oturum kullanıcısı için kısayol (sayfalarda/route'larda user'ı ayrı çekmeye gerek yok).
export async function canAccessCase(c: CaseRef): Promise<boolean> {
  return canCaseBeAccessedBy(await getCurrentUser(), c);
}

// İkinci Görüş vakası sahipliği (spec §8). PATIENT yalnız kendi vakasına; PARTNER erişemez; klinik
// personel (koordinatör/doktor/etik/admin) temel düzeyde erişir. NOT: DOCTOR'ın yalnız KENDİSİNE
// atanmış SO vakasını görmesi (assignedDoctorId scoping) ayrı bir SO-Faz takibidir (bu yardımcı temel
// kuraldır; Case modelindeki tam atama-scoping canCaseBeAccessedBy'da uygulanır).
export function ownsSecondOpinionCase(user: SessionUser | null, c: { patientId: string }): boolean {
  if (!user) return false;
  if (user.role === "PATIENT") return c.patientId === user.id;
  if (user.role === "PARTNER") return false; // hasta DB erişimi yok
  return true; // klinik personel (DOCTOR/COORDINATOR/ETHICS/ADMIN)
}

export async function canAccessSecondOpinionCase(c: { patientId: string }): Promise<boolean> {
  return ownsSecondOpinionCase(await getCurrentUser(), c);
}
