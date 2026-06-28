import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LANGUAGES, COUNTRIES } from "@/lib/constants";

const LANG_SET = new Set(LANGUAGES);
const CODE_SET = new Set(COUNTRIES.map((c) => c.code));

// POST /api/doctor/preferences — hekim kendi hizmet dili / pazarları / aylık kapasite limitini günceller
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

  const languages = Array.isArray(b.languages)
    ? [...new Set((b.languages as unknown[]).filter((l): l is string => typeof l === "string" && LANG_SET.has(l)))]
    : [];
  if (languages.length === 0) {
    return NextResponse.json({ error: "En az bir hizmet dili seçin." }, { status: 400 });
  }

  const markets = Array.isArray(b.markets)
    ? [...new Set((b.markets as unknown[]).filter((m): m is string => typeof m === "string" && CODE_SET.has(m)))]
    : [];

  const capacity = Math.min(200, Math.max(1, Math.round(Number(b.capacity) || 20)));

  // M5 — birim katılımı opt-in'leri (yalnız gövdede boolean geldiyse güncelle; onboarding sonrası değiştirme)
  const optData: { proBonoOptIn?: boolean; consultOptIn?: boolean } = {};
  if (typeof b.proBonoOptIn === "boolean") optData.proBonoOptIn = b.proBonoOptIn;
  if (typeof b.consultOptIn === "boolean") optData.consultOptIn = b.consultOptIn;

  // Not: licenseNo (FHIR Practitioner.identifier) artık /api/doctor/academic'te yönetilir — burada
  // dokunulmaz (tercih kaydı diploma no'yu sıfırlamasın).
  await db.doctor.update({
    where: { id: dbUser.doctorId },
    data: { languages: languages.join(","), markets: markets.length ? markets.join(",") : null, capacity, ...optData },
  });

  return NextResponse.json({ ok: true });
}
