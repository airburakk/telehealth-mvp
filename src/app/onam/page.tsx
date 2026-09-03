import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brandRoleHome } from "@/lib/roles";
import { patientHome } from "@/lib/patient-journey";
import { CONSENT_SCOPE } from "@/lib/consent-config";
import { hasCurrentConsent } from "@/lib/consent";
import { decideConsentScreen, missingConsentScopes } from "@/lib/doctorium-consent";
import { AYDINLATMA_MD } from "@/lib/doctorium-legal/texts/aydinlatma";
import { KOSULLAR_MD } from "@/lib/doctorium-legal/texts/kosullar";
import { OGRENCI_EKI_MD } from "@/lib/doctorium-legal/texts/ogrenci-eki";
import { LegalMarkdown } from "@/components/aura/doctorium-legal/LegalMarkdown";
import { ConsentGate } from "./ConsentGate";
import { DoctoriumConsentGate } from "./DoctoriumConsentGate";
import { ConsentResign } from "./ConsentResign";

export const dynamic = "force-dynamic";

// KVKK onam kapısı — giriş sonrası bir kez. v6.211 (onam mimarisi A + C, 👤 03.09.2026): hangi ekranın
// gösterileceğine DB-taze `missingConsentScopes` karar verir:
//   · Doctorium seti eksik (Aşama 1 doktoru / öğrenci / Aşama 2 doktoru ilk kez)  → DoctoriumConsentGate
//     (belge 01 aydınlatma + [öğrenci eki] + belge 02 sözleşme; ekran = hash'lenen metin)
//   · GENERAL_KVKK eksik (hasta, personel, ya da DOCTOR klinik aktivasyon istiyor: ?scope=clinical
//     veya zaten aktif)                                                            → ConsentGate (telesağlık metni)
//   · Eksik yok ama JWT cv eski (proxy buraya attı)                               → ConsentResign (cv yenile, geç)
// ?scope=clinical: onboarding "bitir" adımı klinik onam olmadan 409 döner ve buraya gönderir; Doctorium
// seti tamsa doğrudan klinik kapı gösterilir.
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
  // Aşama 1 doktorunun "gerekli set"inde GENERAL yoktur; klinik istek (onboarding 409 → ?scope=clinical)
  // GENERAL onamını ayrıca ölçer — yoksa klinik kapı, varsa onboarding'e geri.
  const generalOk = wantsClinical ? await hasCurrentConsent(user.id) : !missing.includes(CONSENT_SCOPE);
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

  if (screen === "clinical" || screen === "general") {
    // DOCTOR burada = Aşama 2 klinik onamı (Doctorium seti tam); hasta/personel = mevcut kapı.
    return <ConsentGate isPatient={user.role === "PATIENT"} role={user.role} dest={dest} clinical={screen === "clinical"} />;
  }

  if (screen === "redirect") redirect(dest); // klinik onam zaten var — onboarding'e dön
  // Set tam ama proxy buraya attıysa JWT cv eskidir (ör. login'den önce alınmış onam) → yeniden imzala.
  return <ConsentResign dest={dest} />;
}
