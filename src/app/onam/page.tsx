import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brandRoleHome } from "@/lib/roles";
import { patientHome } from "@/lib/patient-journey";
import { hasCurrentConsent } from "@/lib/consent";
import { AURA_CORE_SCOPES, decideConsentScreen, missingConsentScopes } from "@/lib/doctorium-consent";
import { AURA_TERMS_TEXT, GENERAL_KVKK_TEXT, STAFF_KVKK_SCOPE, STAFF_KVKK_VERSION, staffKvkkText } from "@/lib/aura-consent-texts";
import { consentLangFor } from "@/lib/consent-lang";
import { isSafeInternalPath } from "@/lib/safe-path";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { AYDINLATMA_MD } from "@/lib/doctorium-legal/texts/aydinlatma";
import { KOSULLAR_MD } from "@/lib/doctorium-legal/texts/kosullar";
import { OGRENCI_EKI_MD } from "@/lib/doctorium-legal/texts/ogrenci-eki";
import { LegalMarkdown } from "@/components/aura/doctorium-legal/LegalMarkdown";
import { isTranslatableLegalLang } from "@/lib/legal-translate";
import { resolveLegalBody } from "@/lib/legal-approval";
import { getTranslations } from "@/lib/i18n";
import { langCodeFor } from "@/lib/constants";
import { CONSENT_GATE_UI_TR_VALUES } from "@/lib/aura-consent-gate-ui";
import { AuraConsentGate, type ConsentCourtesy } from "./AuraConsentGate";
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
  if (!user) redirect(IS_DOCTORIUM_DEPLOY ? "/doctorium/giris?next=/onam" : "/giris?next=/onam"); // marka-duyarlı kapı (proxy ile aynı)

  const { next, scope } = await searchParams;
  // Faz 5: hasta için varsayılan iniş dinamik (vaka merkezi / triyaj); diğer roller marka-duyarlı ana sayfa
  // (v6.185: Doctorium deploy'unda doktor portala iner, AURA host'una savrulmaz).
  const fallback = user.role === "PATIENT" ? await patientHome(user.id) : brandRoleHome(user.role);
  // Hedef site-içi olmalı: kapılar çıkışta tam sayfa gezintisi yapar (leave-gate.ts) → "//host" ve "/\\host" burada süzülür.
  const dest = isSafeInternalPath(next) && next !== "/onam" ? next : fallback;

  const missing = await missingConsentScopes(user.id, user.role);
  // Doctorium deploy'unda klinik kapı YOKTUR (klinik katman yok; 👤 2026-09-19): ?scope=clinical URL'den AURA metnini çağıramaz;
  // gerekli set de yalnız Doctorium belgeleridir (requiredConsentScopes deploy ekseni) → burada ekran ya doctorium ya resign olur.
  const wantsClinical = !IS_DOCTORIUM_DEPLOY && scope === "clinical" && user.role === "DOCTOR";
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
    const display = u?.patientLanguage ?? null;
    // Paket 7 (v6.285, 👤 karar A): TR/EN dışı hasta dili → BİLGİLENDİRME ÇEVİRİSİ birincil okuma (lib/legal-translate, önbellekli);
    // kanonik EN yine hash'lenir, gösterilen çevirinin dili + hash'i kayda ek yazılır. Motor yoksa eski davranış (EN kanonik).
    let courtesy: ConsentCourtesy | null = null;
    if (isTranslatableLegalLang(display)) {
      // 7-C (v6.286): belge başına hukukçu onayı — geçerli onay varsa dondurulmuş metin ("İncelenmiş çeviri"), yoksa otomatik; aydinlatma =
      // GENERAL_KVKK_TEXT.tr, kosullar = AURA_TERMS_TEXT.tr (aynı kanonik sabitler) → /aydinlatma ve /kosullar sayfalarıyla TEK onay.
      const [ayd, kos] = await Promise.all([resolveLegalBody("aydinlatma", display), resolveLegalBody("kosullar", display)]);
      if (ayd && kos) {
        const ui = await getTranslations(display, [...CONSENT_GATE_UI_TR_VALUES]);
        courtesy = {
          lang: display,
          code: langCodeFor(display) ?? "en",
          partial: ayd.partial || kos.partial,
          aydinlatma: <LegalMarkdown markdown={ayd.markdown} />,
          kosullar: <LegalMarkdown markdown={kos.markdown} />,
          hashes: { aydinlatmaHash: ayd.textHash, kosullarHash: kos.textHash },
          status: {
            aydinlatma: { status: ayd.status, reviewedAt: ayd.reviewedAt?.toISOString() ?? null },
            kosullar: { status: kos.status, reviewedAt: kos.reviewedAt?.toISOString() ?? null },
          },
          ui,
        };
      }
    }
    return (
      <AuraConsentGate
        dest={dest}
        initialLang={consentLangFor(display)}
        aydinlatma={{ tr: <LegalMarkdown markdown={GENERAL_KVKK_TEXT.tr} />, en: <LegalMarkdown markdown={GENERAL_KVKK_TEXT.en} /> }}
        kosullar={{ tr: <LegalMarkdown markdown={AURA_TERMS_TEXT.tr} />, en: <LegalMarkdown markdown={AURA_TERMS_TEXT.en} /> }}
        courtesy={courtesy}
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
