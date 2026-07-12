import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";
import { matchForCase } from "@/lib/free-care";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField } from "@/lib/crypto";
import { stampPatientProfile } from "@/lib/patient-journey";

// POST /api/free-care/apply — hasta ön-triyaj → ÜCRETSİZ ücretsiz sağlık hizmeti vaka (ödeme kapısı YOK) → anında eşleşme dener.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const symptoms = String(body.symptoms ?? "").trim();
  if (!symptoms) return NextResponse.json({ error: "Şikayet zorunludur." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Devam için onay gerekli." }, { status: 400 });

  const patientName = String(body.patientName ?? "").trim() || user.name;
  const contact = parseContactFields(body); // FAZ 8 — telefon + iletişim tercihi

  // Branş/aciliyet için triyaj (eşleştirme + doktor bağlamı); ücret/belge kapısı yok.
  const a = await runTriage({
    symptoms,
    durationText: body.durationText ? String(body.durationText) : undefined,
  });

  const created = await db.case.create({
    data: {
      userId: user.id,
      patientName: encryptField(patientName), // kimlik at-rest şifreli (E2EE inc.2c)
      country: String(body.country ?? "TR"),
      language: String(body.language ?? "Türkçe"),
      symptoms: encryptField(symptoms), // E2EE Faz 1 — ücretsiz-hizmet yazımı inc.2'de atlanmıştı (gap fix)
      durationText: body.durationText ? String(body.durationText) : null,
      branch: a.branch,
      urgency: a.urgency,
      confidence: a.confidence,
      reasoning: encryptField(a.reasoning), // E2EE Faz 1 (gap fix)
      status: "NEW",
      freeCare: true,
      freeCareStatus: "WAITING",
      // Hasta iletişim (FAZ 8): telefon kimlik → şifreli; tercih (APP|SMS|EMAIL) düz
      patientPhone: contact.phone ? encryptField(contact.phone) : null,
      contactPreference: contact.contactPreference,
    },
  });

  // Nav bileşimi + profil hafızası (Faz 0)
  await stampPatientProfile(user.id, user.role, {
    journey: "FREE_CARE",
    country: String(body.country ?? ""), language: String(body.language ?? ""),
    phone: contact.phone, contactPref: contact.contactPreference,
  });
  const match = await matchForCase(created.id);
  return NextResponse.json(
    { caseId: created.id, consultationId: match?.consultationId ?? null },
    { status: 201 },
  );
}
