import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { branchIssue } from "@/lib/admin-member-trial";
import { SELECTABLE_SPECIALTY_BRANCHES } from "@/lib/specialty-branch";

export const dynamic = "force-dynamic";

// POST /api/doctor/specialty-branch — sınıflandırılmamış uzmanlık branşını BİR KEZ seçme (👤 2026-10-06).
// Tercihler'deki "Uzmanlık branşınız" kartı yazar; branş uyarısı (lib/branch-reminder) üyeyi oraya götürür.
//
// Kapılar (self-auth — middleware /api'yi korumaz):
//  · yalnız DOCTOR + kendi Doctor kaydı (BOLA yüzeyi yok);
//  · yalnız branşı SINIFLANDIRILMAMIŞ kayıt (boş · listede yok · "Diğer (Sınıflandırılmamış)") — sınıflandırılmış
//    branş buradan DEĞİŞMEZ (409);
//  · admin onaylı doktorda (verified) KAPALI (403): Doctor.branch klinik vaka havuzunu belirler, onaylı doktorun
//    havuzunu kendi kendine değiştirmesi ayrı bir karar konusudur;
//  · yeni değer kayıt formlarıyla AYNI listeden (Diğer hariç).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = await rateLimit(`specialty-branch:${user.id}`, 10, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 });

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }
  const doctor = await db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true, verified: true } });
  if (!doctor) return NextResponse.json({ error: "Doktor profili bulunamadı." }, { status: 404 });
  if (doctor.verified) {
    return NextResponse.json({ error: "Onaylı hesaplarda branş değişikliği yönetim üzerinden yapılır." }, { status: 403 });
  }
  if (!branchIssue(doctor.branch)) {
    return NextResponse.json({ error: "Branşınız zaten kayıtlı." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const branch = String((body as { branch?: unknown }).branch ?? "").trim();
  if (!SELECTABLE_SPECIALTY_BRANCHES.includes(branch)) {
    return NextResponse.json({ error: "Listeden bir branş seçin." }, { status: 400 });
  }

  await db.doctor.update({ where: { id: me.doctorId }, data: { branch } });
  return NextResponse.json({ ok: true, branch });
}
