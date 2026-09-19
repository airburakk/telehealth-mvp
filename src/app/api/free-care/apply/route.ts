import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";
import { matchForCase } from "@/lib/free-care";
import { publishLiveNudge } from "@/lib/ably-server";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField } from "@/lib/crypto";
import { stampPatientProfile } from "@/lib/patient-journey";
import { createHash } from "crypto";
import { recordAccess, reqMeta } from "@/lib/audit";
import { consentLangFor } from "@/lib/consent-lang";
import { FREE_CARE_ON_BEHALF_DECLARATION, FREE_CARE_ON_BEHALF_VERSION, onBehalfError, parseForWhom } from "@/lib/free-care-declaration";

// POST /api/free-care/apply — hasta ön-triyaj → ÜCRETSİZ ücretsiz sağlık hizmeti vaka (ödeme kapısı YOK) → anında eşleşme dener.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const symptoms = String(body.symptoms ?? "").trim();
  if (!symptoms) return NextResponse.json({ error: "Şikayet zorunludur." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Devam için onay gerekli." }, { status: 400 });
  // R6 — yakını adına başvuru (A02 madde 3.4 · A01 madde 12, kod Paket D 2026-09-19): beyan kutusu işaretlenmeden başvuru
  // GÖNDERİLEMEZ (istemci de denetler; sunucu ASIL kapı).
  const forWhom = parseForWhom(body.forWhom);
  const behalfErr = onBehalfError(forWhom, body.onBehalfDeclared === true);
  if (behalfErr) return NextResponse.json({ error: behalfErr }, { status: 400 });

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

  // Beyanın kaydı: denetim zincirine (başvuru başına; metin sürümü + sha256 — hangi metnin onaylandığı ispatlanır).
  // Onam zincirine DEĞİL: ConsentRecord kullanıcı×kapsam×sürüm tekildir, başvuru başına olmaz. recordAccess fail-safe.
  if (forWhom === "relative") {
    const dLang = consentLangFor(String(body.language ?? "") || null);
    await recordAccess({
      actor: user, action: "FREECARE_ON_BEHALF_DECLARATION", resourceType: "CASE", resourceId: created.id, subjectUserId: user.id,
      detail: `yakını adına başvuru beyanı v${FREE_CARE_ON_BEHALF_VERSION} dil=${dLang} sha256=${createHash("sha256").update(FREE_CARE_ON_BEHALF_DECLARATION[dLang]).digest("hex")}`,
      ...reqMeta(req),
    });
  }

  // Nav bileşimi + profil hafızası (Faz 0)
  await stampPatientProfile(user.id, user.role, {
    journey: "FREE_CARE",
    country: String(body.country ?? ""), language: String(body.language ?? ""),
    phone: contact.phone, contactPref: contact.contactPreference,
  });
  const match = await matchForCase(created.id);
  await publishLiveNudge("free-care"); // kuyruk uzadı → doktor konsolları waitingCount'u tazelesin (v6.28)
  return NextResponse.json(
    { caseId: created.id, consultationId: match?.consultationId ?? null },
    { status: 201 },
  );
}
