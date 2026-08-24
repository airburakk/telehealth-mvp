import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAccess, reqMeta } from "@/lib/audit";

// AŞAMA 2 — klinik/hastane telefonu geri-arama teyidi (v6.126, İNSAN-İŞLETİMLİ katman).
// Akış: doktor kurum beyan eder → koordinatör HealthTürkiye dizinindeki RESMÎ tesis numarasını
// (RegistryHospital.phone — kamuya açık dizin verisi) arar, doktoru telefonda teyit eder ve
// buradan damgalar. Otomasyon BİLİNÇLİ YOK: bu katmanın değeri insan teyidinde (vault §8.2).
//   POST   { establishment } → clinicPhoneVerifiedAt damgala (audit: CLINIC_PHONE_VERIFY)
//   DELETE                    → damgayı geri al (yanlış teyit düzeltmesi; audit'li)
// Self-auth: yalnız COORDINATOR/ADMIN; diğer herkese 404 (varlık gizlenir — admin uçları deseni).
// Damga kalkar/düşerse klinik kapı kararını refreshActivation verir (gate açıkken).

const VERIFIER_ROLES = ["COORDINATOR", "ADMIN"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !VERIFIER_ROLES.includes(user.role)) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const doctor = await db.doctor.findUnique({ where: { id }, select: { id: true } });
  if (!doctor) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const establishment = String(b.establishment ?? "").trim().slice(0, 200);
  if (!establishment) {
    return NextResponse.json({ error: "Teyit edilen tesis adı gerekli (HealthTürkiye kaydındaki ad)." }, { status: 400 });
  }

  await db.doctor.update({
    where: { id },
    data: { clinicPhoneVerifiedAt: new Date(), clinicPhoneEstablishment: establishment },
  });

  const u = await db.user.findFirst({ where: { doctorId: id }, select: { id: true } });
  await recordAccess({
    actor: user, action: "CLINIC_PHONE_VERIFY", resourceType: "DOCTOR", resourceId: id,
    subjectUserId: u?.id ?? null, detail: `tesis=${establishment.slice(0, 120)}`, ...reqMeta(req),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !VERIFIER_ROLES.includes(user.role)) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const doctor = await db.doctor.findUnique({ where: { id }, select: { id: true, clinicPhoneVerifiedAt: true } });
  if (!doctor) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  await db.doctor.update({
    where: { id },
    data: { clinicPhoneVerifiedAt: null, clinicPhoneEstablishment: null },
  });

  const u = await db.user.findFirst({ where: { doctorId: id }, select: { id: true } });
  await recordAccess({
    actor: user, action: "CLINIC_PHONE_REVOKE", resourceType: "DOCTOR", resourceId: id,
    subjectUserId: u?.id ?? null, detail: "geri-arama teyidi geri alındı", ...reqMeta(req),
  });
  return NextResponse.json({ ok: true });
}
