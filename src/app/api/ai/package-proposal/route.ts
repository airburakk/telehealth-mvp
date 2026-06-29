import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { proposePackage } from "@/lib/ai-clinical";
import { computePackage, type PackageSelection } from "@/lib/pricing";
import { countryName } from "@/lib/constants";
import { decryptField } from "@/lib/crypto";

// POST /api/ai/package-proposal — Sağlık Turizmi Agent'ı: nihai SOAP'tan paket teklifi.
// AI yalnız parametreleri seçer; fiyat HER ZAMAN platform motorunda (computePackage) hesaplanır.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const caseId = String(b.caseId ?? "");
  if (!caseId) return NextResponse.json({ error: "caseId gerekli." }, { status: 400 });

  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { consultations: { orderBy: { startedAt: "desc" } } },
  });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  // IDOR kapısı: yalnız erişilebilen vaka AI paket teklifine gönderilir (T3 + atama-bazlı T2).
  if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

  // SOAP at-rest şifreli → her notu çöz, ilk dolu olanı al (teklif nihai SOAP'a göre).
  const soap = c.consultations.map((x) => decryptField(x.notes)).find((n) => n.trim())?.trim() ?? "";
  if (!soap) return NextResponse.json({ error: "Önce görüşme notunu (SOAP) kaydedin — teklif nihai SOAP'a göre hazırlanır." }, { status: 400 });

  try {
    const p = await proposePackage(soap, {
      patientName: decryptField(c.patientName), // kimlik at-rest şifreli → AI girdisi için çöz (E2EE inc.2c)
      branch: c.branch,
      countryName: countryName(c.country),
      language: c.language,
      urgency: c.urgency,
    });

    const selection: PackageSelection = {
      branch: c.branch,
      country: c.country,
      tier: p.tier,
      hotelStars: p.hotelStars,
      hospitalType: p.hospitalType,
      nights: p.nights,
      translator: p.translator,
      insuranceExtended: p.insuranceExtended,
      insuranceMalpractice: p.insuranceMalpractice,
    };
    const quote = computePackage(selection);

    return NextResponse.json({ proposal: p, selection, quote });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
