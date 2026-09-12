import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brandRoleHome } from "@/lib/roles";
import { patientHome } from "@/lib/patient-journey";
import { hasCurrentConsent } from "@/lib/consent";
import { AURA_CORE_SCOPES, decideConsentScreen, missingConsentScopes } from "@/lib/doctorium-consent";
import { AURA_TERMS_TEXT, GENERAL_KVKK_TEXT, STAFF_KVKK_SCOPE, STAFF_KVKK_VERSION, staffKvkkText } from "@/lib/aura-consent-texts";
import { consentLangFor } from "@/lib/consent-lang";
import { AYDINLATMA_MD } from "@/lib/doctorium-legal/texts/aydinlatma";
import { KOSULLAR_MD } from "@/lib/doctorium-legal/texts/kosullar";
import { OGRENCI_EKI_MD } from "@/lib/doctorium-legal/texts/ogrenci-eki";
import { LegalMarkdown } from "@/components/aura/doctorium-legal/LegalMarkdown";
import { AuraConsentGate } from "./AuraConsentGate";
import { StaffConsentGate } from "./StaffConsentGate";
import { DoctoriumConsentGate } from "./DoctoriumConsentGate";
import { ConsentResign } from "./ConsentResign";

export const dynamic = "force-dynamic";

// KVKK onam kapısı — giriş sonrası bir kez. v6.211 (onam mimarisi A + C, 👤 03.09.2026): hangi ekranın gösterileceğine
// DB-taze `missingConsentScopes` karar verir. v6.269 (kod Paket B — AURA hukuki set Sürüm 1.0 NİHAİ): AURA tarafı da
// EKRAN = HASH:
//   · Doctorium seti eksik (Aşama 1 doktoru / öğrenci / Aşama 2 doktoru ilk kez)  → DoctoriumConsentGate
//   · PATIENT, GENERAL_KVKK v4 / AURA_TERMS v1 eksik                              → AuraConsentGate (A01 + A02 tam metin,
//     TR/EN; hasta diline göre başlangıç dili; hash gösterilen dilin metni)
//   · personel STAFF_KVKK eksik, ya da DOCTOR klinik aktivasyon istiyor (?scope=clinical) / zaten aktif → StaffConsentGate
//     (A09 + yalnız rolün madde 10 kesiti; DOCTOR = "clinical" ekranı — Aşama 2 bandı)
//   · Eksik yok ama JWT cv eski (proxy buraya attı)                               → ConsentResign (cv yenile, geç)
// ?scope=clinical: onboarding "bitir" adımı klinik onam olmadan 409 döner ve buraya gönderir; Doctorium seti tamsa
// doğrudan klinik kapı gösterilir. Gösterilen düğümler (LegalMarkdown) sunucuda üretilir; kapılar yalnız sarmalar.
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ next?: string; scope?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/onam");

  const { next, scope } = await searchParams;
  // Faz 5: hasta için varsayılan iniş dinamik (vaka merkezi / triyaj); diğer roller marka-duyarlı ana sayfa
  // (v6.185: Doctorium deploy'unda doktor portala iner, AURA host'una savrulmaz).
  const fallback = user.role === "PATIENT" ? await patientHome(user.id) : brandRoleHome(user.role);
  const dest = next && next.startsWith("/") && next !== "/onam" ? next : fallback;

  const missing = await missingConsentScopes(user.id, user.role);
  const wantsClinical = scope === "clinical" && user.role === "DOCTOR";
  // Aşama 1 doktorunun "gerekli set"inde STAFF_KVKK yoktur; klinik istek (onboarding 409 → ?scope=clinical) onu ayrıca
  // ölçer — yoksa klinik kapı, varsa onboarding'e geri.
  const generalOk = wantsClinical
    ? await hasCurrentConsent(user.id, STAFF_KVKK_SCOPE, STAFF_KVKK_VERSION)
    : !missing.some((s) => AURA_CORE_SCOPES.includes(s));
  const screen = decideConsentScreen({ role: user.role, missing, wantsClinical, generalOk });

  if (screen === "doctorium") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const d = me?.doctorId
      ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { studentTrack: true, studentVerifiedAt: true } })
      : null;
    const student = !!(d?.studentTrack || d?.studentVerifiedAt);
    return (
      <DoctoriumConsentGate
        dest={dest}
        student={student}
        aydinlatma={<LegalMarkdown markdown={AYDINLATMA_MD} />}
        ogrenciEki={student ? <LegalMarkdown markdown={OGRENCI_EKI_MD} /> : null}
        kosullar={<LegalMarkdown markdown={KOSULLAR_MD} />}
      />
    );
  }

  if (screen === "general" && user.role === "PATIENT") {
    // Başlangıç dili: hastanın profil dili (air_lang ile aynı sözlük) → Türkçe ise TR, değilse EN kanonik (S4).
    const u = await db.user.findUnique({ where: { id: user.id }, select: { patientLanguage: true } });
    return (
      <AuraConsentGate
        dest={dest}
        initialLang={consentLangFor(u?.patientLanguage)}
        aydinlatma={{ tr: <LegalMarkdown markdown={GENERAL_KVKK_TEXT.tr} />, en: <LegalMarkdown markdown={GENERAL_KVKK_TEXT.en} /> }}
        kosullar={{ tr: <LegalMarkdown markdown={AURA_TERMS_TEXT.tr} />, en: <LegalMarkdown markdown={AURA_TERMS_TEXT.en} /> }}
      />
    );
  }

  if (screen === "clinical" || screen === "general") {
    // DOCTOR burada = Aşama 2 klinik onamı (Doctorium seti tam); personel = STAFF_KVKK rol kesiti. Hash rol × dil.
    return (
      <StaffConsentGate
        dest={dest}
        role={user.role}
        clinical={screen === "clinical"}
        text={{ tr: <LegalMarkdown markdown={staffKvkkText(user.role, "tr")} />, en: <LegalMarkdown markdown={staffKvkkText(user.role, "en")} /> }}
      />
    );
  }

  if (screen === "redirect") redirect(dest); // klinik onam zaten var — onboarding'e dön
  // Set tam ama proxy buraya attıysa JWT cv eskidir (ör. login'den önce alınmış onam) → yeniden imzala.
  return <ConsentResign dest={dest} />;
}
