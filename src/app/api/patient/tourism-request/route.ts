import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { requireUser } from "@/lib/api-auth";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField } from "@/lib/crypto";
import { notifyDoctorsByBranch } from "@/lib/notify";
import { stampPatientJourney } from "@/lib/patient-journey";

// POST /api/patient/tourism-request — Sağlık Turizmi öz-yeterli intake (Faz 2).
// Hasta tercihleri (tier/gece/ülke + seçtiği tedavi alanı) + kısa şikayet/hedef → tourism-etiketli Case
// (tourismPlan JSON dolu, status NEW) → runTriage ile branş/aciliyet → branş doktorlarına bildirim.
// ÜCRET KAPISI YOK (klinik-önce; bağlayıcı ödeme DAİMA doktor onayı + escrow sonrası). tourismPlan lojistik
// (PHI DEĞİL, düz metin). PHI alanları (patientName/symptoms/reasoning) at-rest şifreli (E2EE inc.2c/Faz1).
const TIERS = new Set(["Ekonomik", "Standart", "Premium"]);

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
  const tier = TIERS.has(String(body.tier)) ? String(body.tier) : "Standart";
  const nights = Math.min(30, Math.max(1, Number(body.nights) || 7));
  const area = String(body.branch ?? "").trim(); // hastanın seçtiği tedavi alanı (planlayıcı chip'i)

  // Branş/aciliyet: seçilen tedavi alanını bağlam olarak enjekte et → runTriage KANONİK BRANCHES
  // etiketi döndürür (doktor kuyruğu doctor.branch === case.branch TAM eşleşmesi doğru olsun).
  const a = await runTriage({ symptoms: area ? `Tedavi alanı: ${area}. ${symptoms}` : symptoms });

  // Lojistik tercih (düz metin) — hasta önizlemesiyle aynı; doktor PackageBuilder'ını ön-doldurur.
  const plan = { tier, nights, country, branch: area || a.branch };

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

  await stampPatientJourney(user.id, user.role, "HEALTH_TOURISM"); // nav bileşimi başvurulan akıştan

  return NextResponse.json({ caseId: created.id }, { status: 201 });
}
