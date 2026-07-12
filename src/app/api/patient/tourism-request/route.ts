import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { requireUser } from "@/lib/api-auth";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField } from "@/lib/crypto";
import { notifyDoctorsByBranch, notifyUser } from "@/lib/notify";
import { stampPatientProfile } from "@/lib/patient-journey";
import { BRANCHES } from "@/lib/triage";
import { TOURISM_DISCLAIMER_TITLE, TOURISM_DISCLAIMER_BODY } from "@/lib/tourism-disclaimer";

// POST /api/patient/tourism-request — Sağlık Turizmi öz-yeterli intake (2026-07-12 yeniden tasarım).
// İki adımlı hasta-yüzü: Ön Bilgi (kimlik + iletişim + sağlık durumu) → AI branş → Tedavi Alanı seçimi.
// Bu uç, hastanın NİHAİ branş seçimini (branchKey) alır → forceBranchKey ile o branşta tourism-etiketli
// Case (status NEW) → seçilen BRANŞIN DOKTOR HAVUZUNA bildirim. Doktorlar yazılı teklif/video sunar;
// anlaşınca fiyat girer → acente dosyası → mevcut escrow zinciri. ÜCRET KAPISI YOK (klinik-önce).
// tourismPlan lojistik (PHI DEĞİL, düz metin: country + branch). PHI (patientName/symptoms/reasoning)
// at-rest şifreli (E2EE inc.2c/Faz1). Talep sonrası hastaya AURA-dışı sorumluluk reddi mesajı gider
// (notifyUser — uygulama-içi + push canlı; SMS/e-posta kanalı dormant → aktifleşince eklenir).

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "PATIENT" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem yalnız hasta hesabıyla yapılabilir." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const symptoms = String(body.symptoms ?? "").trim();
  if (symptoms.length < 8) {
    return NextResponse.json({ error: "Lütfen sağlık durumunuzu/hedefinizi kısaca yazın." }, { status: 400 });
  }

  const patientName = String(body.patientName ?? "").trim() || user.name;
  const contact = parseContactFields(body); // FAZ 8 — telefon + iletişim tercihi
  const country = String(body.country ?? "TR");
  // Hastanın Tedavi Alanı adımında seçtiği NİHAİ branş (AI önerisi ön-seçili gelir, hasta değiştirebilir).
  const branchKey = BRANCHES.some((b) => b.key === String(body.branchKey)) ? String(body.branchKey) : undefined;

  // Aciliyet/gerekçe LLM'den; branş HASTANIN seçimiyle kilitli (forceBranchKey) → doktor kuyruğu
  // doctor.branch === case.branch TAM eşleşmesi hasta niyetiyle hizalı.
  const a = await runTriage({ symptoms, forceBranchKey: branchKey });

  // Lojistik tercih (düz metin) — fiyat/paket/gece hasta-yüzünden kalktı; yalnız ülke + branş.
  const plan = { country, branch: a.branch };

  const created = await db.case.create({
    data: {
      userId: user.id,
      patientName: encryptField(patientName), // kimlik at-rest şifreli
      country,
      language: String(body.language ?? "Türkçe"),
      symptoms: encryptField(symptoms), // E2EE Faz 1
      branch: a.branch,
      urgency: a.urgency,
      confidence: a.confidence,
      reasoning: encryptField(a.reasoning),
      status: "NEW",
      tourismPlan: JSON.stringify(plan),
      // Hasta iletişim (FAZ 8): telefon kimlik → şifreli; tercih (APP|SMS|EMAIL) düz
      patientPhone: contact.phone ? encryptField(contact.phone) : null,
      contactPreference: contact.contactPreference,
    },
  });

  await notifyDoctorsByBranch(a.branch, {
    type: "NEW_CASE",
    title: `${a.urgency >= 4 ? "🔴 " : "🧳 "}Sağlık turizmi talebi`, // isim gömülmez (E2EE inc.2c)
    body: `${a.branch} · aciliyet ${a.urgency}/5`,
    href: `/doktor/vaka/${created.id}`,
  });

  // AURA-dışı sorumluluk reddi — hasta iletişim tercihi üzerinden (lib/tourism-disclaimer). Fire-safe:
  // bildirim düşse bile talep oluşturma bozulmaz (hasta onay ekranını yine görür).
  await notifyUser(user.id, {
    type: "TOURISM_DISCLAIMER",
    title: TOURISM_DISCLAIMER_TITLE,
    body: TOURISM_DISCLAIMER_BODY,
    href: `/vaka/${created.id}`,
  });

  // Nav bileşimi + profil hafızası (Faz 0) — turizm intake'inde dil alanı yok (air_lang UI'da)
  await stampPatientProfile(user.id, user.role, {
    journey: "HEALTH_TOURISM",
    country,
    phone: contact.phone, contactPref: contact.contactPreference,
  });

  return NextResponse.json({ caseId: created.id }, { status: 201 });
}
