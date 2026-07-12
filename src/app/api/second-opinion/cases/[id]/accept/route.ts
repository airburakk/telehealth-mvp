import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { isOfferExpired, soBranchVariants } from "@/lib/second-opinion";
import { claimSoCase } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/accept — hoca oto-atanan dosyayı KABUL eder (OFFERED → ASSIGNED).
// Directed (kendisine atanan) hoca süre içinde her zaman; diğer branş hocaları yalnız kabul süresi
// DOLDUYSA (lazy fan-out → ilk kabul eden alır, atomik claimSoCase). Koordinatör YOK.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const myDoctorId = me?.doctorId;
  if (!myDoctorId) return NextResponse.json({ error: "Doktor profili bulunamadı." }, { status: 403 });

  const doctor = await db.doctor.findUnique({ where: { id: myDoctorId } });
  if (!doctor) return NextResponse.json({ error: "Doktor bulunamadı." }, { status: 404 });
  // Doğrulanmamış (self-signup) hekim dosya üstlenemez — üstlense de canSoCaseBeAccessedBy her uçta
  // reddederdi → vaka erişilemez kilitlenirdi (oto-atama zaten yalnız verified'a teklif eder).
  if (!doctor.verified) return NextResponse.json({ error: "Hesabınız henüz onaylanmadı — dosya üstlenemezsiniz." }, { status: 403 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (c.status !== "OFFERED") return NextResponse.json({ error: "Bu dosya kabul aşamasında değil." }, { status: 409 });
  if (!soBranchVariants(doctor.branch).includes(c.branch)) return NextResponse.json({ error: "Bu dosya sizin branşınızda değil." }, { status: 403 }); // anahtar/etiket uyuşmazlığı düzeltmesi (Faz 3)

  // Yetki: kendisine atanan (directed) hoca her zaman; başka branş hocası YALNIZ kabul süresi dolduysa
  const directed = c.assignedDoctorId === myDoctorId;
  if (!directed && !isOfferExpired(c.assignedAt)) {
    return NextResponse.json({ error: "Bu dosya şu an atanan doktorun kabul süresinde — henüz açık değil." }, { status: 409 });
  }

  const ok = await claimSoCase(id, myDoctorId, { actorId: user.id, actorRole: user.role });
  if (!ok) return NextResponse.json({ error: "Bu dosya artık uygun değil (başka doktor aldı)." }, { status: 409 });

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
  await notifyUser(c.patientId, {
    type: "SO_ASSIGNED",
    title: "🩺 Uzman doktorunuz dosyanızı aldı",
    body: `${branchLabel} · inceleme başladı`,
    href: `/second-opinion/vaka/${id}`,
  });

  return NextResponse.json({ ok: true, status: "ASSIGNED" });
}
