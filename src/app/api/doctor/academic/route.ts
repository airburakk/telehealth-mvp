import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/doctor/academic — hekim kendi akademik/eğitim profilini günceller (yalnız kendi kaydı).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir hekim profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const yr = (v: unknown): number | null => { const n = Math.round(Number(v)); return n >= 1900 && n <= 2100 ? n : null; };

  const certifications = Array.isArray(b.certifications)
    ? (b.certifications as unknown[]).filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim().slice(0, 200)).slice(0, 20)
    : [];
  const publications = Array.isArray(b.publications)
    ? (b.publications as unknown[])
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p) => ({ title: String(p.title ?? "").trim().slice(0, 300), venue: String(p.venue ?? "").trim().slice(0, 200), year: yr(p.year) ?? new Date().getFullYear() }))
        .filter((p) => p.title)
        .slice(0, 30)
    : [];

  await db.doctor.update({
    where: { id: dbUser.doctorId },
    data: {
      eduSchool: str(b.eduSchool, 300),
      eduYear: yr(b.eduYear),
      specBoard: str(b.specBoard, 200),
      specYear: yr(b.specYear),
      certifications: certifications.length ? JSON.stringify(certifications) : null,
      publications: publications.length ? JSON.stringify(publications) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
