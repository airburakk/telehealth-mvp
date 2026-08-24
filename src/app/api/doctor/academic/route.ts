import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/doctor/academic — doktor kendi akademik/eğitim profilini günceller (yalnız kendi kaydı).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const yr = (v: unknown): number | null => { const n = Math.round(Number(v)); return n >= 1900 && n <= 2100 ? n : null; };

  // ── KISMİ GÜNCELLEME (v6.105, kullanıcı kararı 2026-08-17) ────────────────────────────────
  // Akademik form İKİ kutuya bölündü ve kutular sayfanın FARKLI bölümlerinde duruyor
  // ("Akademik & Eğitim" → Mesleki Belgeler altında · "Sertifikalar & Akademik Çalışmalar" →
  // kendi başlığı altında), her birinin kendi kaydet düğmesi var.
  // ⚠️ Bu uç eskiden gövdedeki TÜM alanları koşulsuz yazıyordu → bölünmüş kutular birbirini
  // EZERDİ: sertifikaları kaydetmek licenseNo/specBoard'ı null yapar ve bu ikisi onboarding
  // aktivasyon şartı olduğu için hesabı sessizce deaktive ederdi. Artık yalnız GÖVDEDE GEÇEN
  // alanlar güncellenir; gönderilmeyen alana dokunulmaz.
  // `in` operatörü kullanılır ("undefined" ile "açıkça null gönderildi" ayrımı korunur:
  // kullanıcı bir alanı BOŞALTMAK isterse "" gönderir → str() null'a çevirir → temizlenir).
  const data: Record<string, unknown> = {};
  // FHIR Practitioner.identifier — diploma/tescil no (qualification ile birlikte tek yerde toplanır)
  if ("licenseNo" in b) data.licenseNo = str(b.licenseNo, 100);
  if ("eduSchool" in b) data.eduSchool = str(b.eduSchool, 300);
  if ("eduYear" in b) data.eduYear = yr(b.eduYear);
  if ("specBoard" in b) data.specBoard = str(b.specBoard, 200);
  if ("specYear" in b) data.specYear = yr(b.specYear);
  if ("certifications" in b) {
    const certifications = Array.isArray(b.certifications)
      ? (b.certifications as unknown[]).filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim().slice(0, 200)).slice(0, 20)
      : [];
    data.certifications = certifications.length ? JSON.stringify(certifications) : null;
  }
  if ("publications" in b) {
    const publications = Array.isArray(b.publications)
      ? (b.publications as unknown[])
          .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
          .map((p) => ({ title: String(p.title ?? "").trim().slice(0, 300), venue: String(p.venue ?? "").trim().slice(0, 200), year: yr(p.year) ?? new Date().getFullYear() }))
          .filter((p) => p.title)
          .slice(0, 30)
      : [];
    data.publications = publications.length ? JSON.stringify(publications) : null;
  }

  // Boş gövde = yazacak bir şey yok; gereksiz UPDATE atma.
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true, skipped: true });

  await db.doctor.update({ where: { id: dbUser.doctorId }, data });

  return NextResponse.json({ ok: true });
}
