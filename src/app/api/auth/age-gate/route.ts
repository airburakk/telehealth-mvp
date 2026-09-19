import { NextResponse } from "next/server";
import { isAdultPatient, isValidBirthDate, UNDERAGE_MESSAGE } from "@/lib/patient-age";
import { AGE_GATE_COOKIE, ageGateCookieOptions, issueAgeGateToken } from "@/lib/age-gate";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

// POST /api/auth/age-gate — hasta 18+ kapısı (kod Paket D, 2026-09-19; A01 madde 3.2 / A02 madde 3.1, 👤 S3).
// body: { birthDate: "YYYY-AA-GG" }. Doğum tarihi yalnız burada, bellekte hesaplanır: SAKLANMAZ, LOGLANMAZ, yanıta
// yazılmaz. Geçerse imzalı "geçildi" çerezi (15 dk) yazılır — Google/Apple ile YENİ hasta hesabı açılışı bu çerezi
// ister (callback'ler). E-posta kaydı bu uca bağlı değildir: signup-patient doğum tarihini kendi gövdesinden yeniden
// doğrular (çerez yalnız OAuth için). Kimliksiz uç (kayıt öncesi) → IP başına fren.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = await rateLimit(`age-gate:${clientIp(req)}`, 30, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const birthDate = String(b.birthDate ?? "").trim();
  if (!isValidBirthDate(birthDate)) return NextResponse.json({ error: "Doğum tarihinizi girin." }, { status: 400 });
  if (!isAdultPatient(birthDate)) return NextResponse.json({ error: UNDERAGE_MESSAGE.tr, code: "UNDERAGE" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AGE_GATE_COOKIE, issueAgeGateToken(), ageGateCookieOptions());
  return res;
}
