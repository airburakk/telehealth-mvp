import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { recordAccess, reqMeta } from "@/lib/audit";
import { startChallenge, confirmChallenge, type VerifyChannel } from "@/lib/doctor-verify";

// AŞAMA 2 doğrulama kanalları (v6.126): /api/doctor/verify/sms · /api/doctor/verify/work-email
//   POST { target }  → OTP üret + kanaldan gönder (env yoksa simülasyon — dormant)
//   PUT  { code }    → kodu doğrula → Doctor damgası (smsVerifiedAt / workEmailVerifiedAt)
// Self-auth ŞART (middleware /api'yi korumaz): yalnız kendi doctorId'si üzerinde çalışır (IDOR yok
// — hedef doktor daima oturumdan türetilir, istekten ASLA alınmaz). Rate limit: kod gönderimi
// pahalı yüzeydir (SMS maliyeti + taciz) → doktor başına 5/10dk; doğrulama denemesi ayrıca
// lib/doctor-verify MAX_ATTEMPTS ile satır düzeyinde sınırlı.
// 🔒 OTP kodu bu dosyada da LOGLANMAZ; audit detail yalnız kanal + sonuç taşır.

const CHANNELS: Record<string, VerifyChannel> = { sms: "SMS", "work-email": "WORK_EMAIL" };

async function myDoctorId(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  return u?.doctorId ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: seg } = await params;
  const channel = CHANNELS[seg];
  if (!channel) return NextResponse.json({ error: "Bilinmeyen kanal." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });

  const rl = await rateLimit(`verify-start:${doctorId}:${channel}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Çok sık kod istendi — ${rl.retryAfter} sn sonra deneyin.` }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const target = String(b.target ?? "").slice(0, 200);
  if (!target) return NextResponse.json({ error: "target gerekli (telefon / iş e-postası)." }, { status: 400 });

  const r = await startChallenge(doctorId, channel, target);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });

  await recordAccess({
    actor: user, action: "DOCTOR_VERIFY_START", resourceType: "DOCTOR", resourceId: doctorId,
    subjectUserId: user.id, detail: `kanal=${channel} simulasyon=${r.simulated ? "EVET" : "HAYIR"}`,
    ...reqMeta(req),
  });
  return NextResponse.json({ ok: true, simulated: !!r.simulated });
}

export async function PUT(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: seg } = await params;
  const channel = CHANNELS[seg];
  if (!channel) return NextResponse.json({ error: "Bilinmeyen kanal." }, { status: 404 });

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const code = String(b.code ?? "").slice(0, 12);
  if (!code) return NextResponse.json({ error: "code gerekli." }, { status: 400 });

  const r = await confirmChallenge(doctorId, channel, code);
  await recordAccess({
    actor: user, action: "DOCTOR_VERIFY_CONFIRM", resourceType: "DOCTOR", resourceId: doctorId,
    subjectUserId: user.id, detail: `kanal=${channel} sonuc=${r.ok ? "DOGRULANDI" : "RET"}`,
    ...reqMeta(req),
  });
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}
