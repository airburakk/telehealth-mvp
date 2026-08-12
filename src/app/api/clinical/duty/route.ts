import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasClinicalAccess } from "@/lib/doctor-activation";
import { dutyFeed, setClinicalDuty, releaseClinicalDoctor, type DutyPatch } from "@/lib/clinical-duty";

export const dynamic = "force-dynamic";

// Oturumdaki kullanıcının doktor profili (DOCTOR/ADMIN). SessionUser doctorId taşımaz → DB'den çöz.
// v6.87 Aşama 2 kapısı: aktivasyonsuz DOCTOR nöbet API'sini hiç kullanamaz (toggle + feed; ADMIN
// gözetimi muaf) — sayfa kapısı yetmez, route kendi auth'unu yapar (api-routes-need-self-auth).
async function resolveDoctor() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) return { user, doctorId: null as string | null };
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) return { user, doctorId: null as string | null };
  if (user.role === "DOCTOR") {
    const d = await db.doctor.findUnique({ where: { id: me.doctorId }, select: { activatedAt: true } });
    if (!d || !hasClinicalAccess(d)) return { user, doctorId: null as string | null };
  }
  return { user, doctorId: me.doctorId };
}

// GET /api/clinical/duty — nöbet durumu + İcapçı gelen kutusu + (Nöbetçi kapıldıysa) görüşme yönlendirmesi.
export async function GET() {
  const { user, doctorId } = await resolveDoctor();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!doctorId) return NextResponse.json({ error: "Doktor profili yok veya klinik aktivasyon tamamlanmadı." }, { status: 403 });
  return NextResponse.json((await dutyFeed(doctorId)) ?? {});
}

// POST /api/clinical/duty — nöbet durumunu güncelle (Branş online / İcap / Nöbetçi).
export async function POST(req: Request) {
  const { user, doctorId } = await resolveDoctor();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!doctorId) return NextResponse.json({ error: "Doktor profili yok veya klinik aktivasyon tamamlanmadı." }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  // Nöbet görüşmesi bitti → IN_SESSION'dan serbest bırak (Nöbetçi ise ONLINE'a, değilse OFFLINE'a döner).
  if (body.release === true) {
    await releaseClinicalDoctor(doctorId);
    return NextResponse.json((await dutyFeed(doctorId)) ?? {});
  }

  const patch: DutyPatch = {};
  if (body.clinicalState === "ONLINE" || body.clinicalState === "OFFLINE") patch.clinicalState = body.clinicalState;
  if (typeof body.onCall === "boolean") patch.onCall = body.onCall;
  if (typeof body.sentinel === "boolean") patch.sentinel = body.sentinel;

  await setClinicalDuty(doctorId, patch);
  return NextResponse.json((await dutyFeed(doctorId)) ?? {});
}
