import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import { setEduFollow } from "@/lib/edu-store";

// Kariyer EDU takibi (E2, 2026-09-06) — POST { opportunityId, follow }. Self-auth (middleware /api'yi korumaz): DOCTOR + Doctorium
// kitlesi ÖĞRENCİ (Kariyer EDU öğrenci yüzeyidir; doktor/deneme 403). Yalnız onaylı fırsat takip edilebilir (edu-store).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const ctx = await currentDoctoriumAudience();
  if (!ctx?.doctorId || !ctx.flags.showsStudentSurfaces) return NextResponse.json({ error: "Fırsat takibi tıp öğrencisi üyeliğine özeldir." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const opportunityId = typeof b.opportunityId === "string" ? b.opportunityId.slice(0, 80) : "";
  if (!opportunityId) return NextResponse.json({ error: "opportunityId gerekli." }, { status: 400 });
  const r = await setEduFollow(ctx.doctorId, opportunityId, b.follow !== false);
  if (!r.ok) return NextResponse.json({ error: "Fırsat bulunamadı ya da yayında değil." }, { status: 404 });
  return NextResponse.json({ ok: true, following: r.following });
}
