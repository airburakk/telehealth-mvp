import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptField } from "@/lib/crypto";
import { refreshActivation } from "@/lib/doctor-activation";

// Mesleki Mali Sorumluluk Sigortası (MMSS) poliçe metadata'sı. Teminat limiti M3 Katman 3
// malpraktis ek-prim hesabının doğrudan girdisi → eksiksiz olması zorunlu.
const CURRENCIES = ["TRY", "USD"];

async function myDoctorId(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  return u?.doctorId ?? null;
}

// POST /api/doctor/mmss — MMSS poliçe bilgilerini kaydet (sigortacı, poliçe no, teminat limiti, birim, geçerlilik).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir hekim profiline bağlı değil." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const insurer = String(b.insurer ?? "").trim().slice(0, 120);
  const policyNo = String(b.policyNo ?? "").trim().slice(0, 80);
  const coverageLimit = Math.round(Number(b.coverageLimit));
  const currency = CURRENCIES.includes(b.currency) ? b.currency : "TRY";
  const validUntilRaw = b.validUntil ? new Date(b.validUntil) : null;
  const validUntil = validUntilRaw && !isNaN(validUntilRaw.getTime()) ? validUntilRaw : null;

  if (!insurer) return NextResponse.json({ error: "Sigorta şirketi gerekli." }, { status: 400 });
  if (!policyNo) return NextResponse.json({ error: "Poliçe numarası gerekli." }, { status: 400 });
  if (!Number.isFinite(coverageLimit) || coverageLimit <= 0) {
    return NextResponse.json({ error: "Geçerli bir teminat limiti girin." }, { status: 400 });
  }

  await db.doctor.update({
    where: { id: doctorId },
    data: {
      mmssInsurer: insurer,
      mmssPolicyNo: encryptField(policyNo), // poliçe no at-rest şifreli (E2EE Faz 1)
      mmssCoverageLimit: coverageLimit,
      mmssCoverageCurrency: currency,
      mmssValidUntil: validUntil,
    },
  });

  const activated = await refreshActivation(doctorId);
  return NextResponse.json({ ok: true, activated });
}
