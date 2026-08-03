import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";
import { logSoEvent } from "@/lib/second-opinion-service";
import { soCaseListScope } from "@/lib/ownership";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField, decryptSoCaseFields } from "@/lib/crypto";
import { stampPatientProfile } from "@/lib/patient-journey";

// GET /api/second-opinion/cases — SO vakalarını listeler. Kapsam ROLE GÖRE daraltılır:
// hasta kendi vakaları · doğrulanmış doktor yalnız KENDİSİNE ATANMIŞLAR · koordinatör/etik/admin geniş ·
// PARTNER/AGENCY/doğrulanmamış doktor → 403.
// ⚠️ Eski hâli `where: user.role === "PATIENT" ? {…} : {}` idi: PATIENT dışı her role 100 vakanın
// DÜZ-METİN tanı özetini veriyordu (2026-08-03 dış denetimi P0). Doktor self-signup açık olduğundan
// bu uç internetten erişilebilirdi. Kapsam artık tek kaynaktan gelir — elle `where` KURMA.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const scope = await soCaseListScope(user);
  if (!scope) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const cases = await db.secondOpinionCase.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    // Personel (gözetim) dalı emniyet tavanı — hasta dalı sınırsız (kendi vakaları zaten az).
    ...(user.role === "PATIENT" ? {} : { take: 100 }),
    include: {
      documents: { select: { id: true, type: true, deliveryMethod: true } },
      payment: { select: { status: true } },
      requests: { where: { status: "PENDING" }, select: { id: true, type: true } },
    },
  });
  // Klinik alanlar at-rest şifreli → yanıt için çöz (decryptSoCaseFields; düz-metin passthrough).
  return NextResponse.json(cases.map((c) => decryptSoCaseFields(c)));
}

// POST /api/second-opinion/cases — yeni ikinci görüş vakası (DRAFT). KVKK açık rıza zorunlu (§8).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const consent = body.consent === true;
  const diagnosisSummary = String(body.diagnosisSummary ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  const country = String(body.country ?? "").trim();
  const language = String(body.language ?? "").trim();

  if (!consent) {
    return NextResponse.json({ error: "Devam etmek için açık rıza onayı gereklidir." }, { status: 400 });
  }
  if (diagnosisSummary.length < 10) {
    return NextResponse.json({ error: "Lütfen mevcut tanınızı kısaca özetleyin (en az 10 karakter)." }, { status: 400 });
  }
  if (!BRANCHES.some((b) => b.key === branch)) {
    return NextResponse.json({ error: "Geçerli bir tıbbi branş seçin." }, { status: 400 });
  }
  if (!COUNTRIES.some((c) => c.code === country)) {
    return NextResponse.json({ error: "Lütfen ülkenizi seçin." }, { status: 400 });
  }
  if (!LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "Lütfen tercih ettiğiniz iletişim dilini seçin." }, { status: 400 });
  }

  const contact = parseContactFields(body); // FAZ 8 — telefon + iletişim tercihi
  const created = await db.secondOpinionCase.create({
    data: {
      patientId: user.id,
      branch,
      // Tanı özeti = özel nitelikli sağlık verisi → at-rest şifreli (2026-08-03 denetimi P1).
      // decryptField düz metni aynen geçirir → eski kayıtlar backfill'siz de okunmaya devam eder.
      diagnosisSummary: encryptField(diagnosisSummary.slice(0, 4000)),
      country,
      language,
      status: "DRAFT",
      consentAt: new Date(),
      // Hasta iletişim (FAZ 8): telefon kimlik → şifreli; tercih (APP|SMS|EMAIL) düz
      patientPhone: contact.phone ? encryptField(contact.phone) : null,
      contactPreference: contact.contactPreference,
    },
  });
  await logSoEvent(created.id, {
    actorId: user.id,
    actorRole: user.role,
    action: "STATUS_CHANGE",
    detail: "→DRAFT (açık rıza alındı)",
  });
  // Nav bileşimi + profil hafızası (Faz 0)
  await stampPatientProfile(user.id, user.role, {
    journey: "SECOND_OPINION",
    country, language,
    phone: contact.phone, contactPref: contact.contactPreference,
  });
  return NextResponse.json(created, { status: 201 });
}
