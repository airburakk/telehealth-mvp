// AURA hasta onam kapısı arayüz sözlüğü — SAF modül (Paket 7, v6.285): TR/EN kanonik; TR/EN dışı arayüz dilinde sunucu
// (app/onam/page.tsx) TR değerleri getTranslations ile çevirip kapıya geçirir. "use client" modülünden veri export'u RSC'de
// proxy'ye dönüştüğü için sözlük burada yaşar ([[rsc-client-module-data-export]]).
import { AURA_LEGAL_DATE_LABEL, AURA_LEGAL_VERSION } from "./aura-legal/routes";
import type { ConsentLang } from "./consent-lang";

export type ConsentGateUi = {
  title: string; sub: string; intro: string; sec1: string; sec2: string; read: string; accept: string; button: string;
  err: string; proofBefore: string; proofLink: string; proofAfter: string; open: string; tr: string; en: string;
  courtesy: string; canonical: string; partial: string;
  auto: string; reviewed: string; // 7-C (v6.286): bölüm başı rozeti — otomatik / incelenmiş (tarih kodda eklenir)
};

export const CONSENT_GATE_UI: Record<ConsentLang, ConsentGateUi> = {
  tr: {
    title: "Aydınlatma Metni ve Açık Rıza · Kullanım Koşulları",
    sub: `Sürüm ${AURA_LEGAL_VERSION} · ${AURA_LEGAL_DATE_LABEL.tr} · bir kez onaylanır, her girişte yeniden sorulmaz`,
    intro: "Hizmeti sunabilmemiz için kişisel verilerinizin nasıl işlendiğini anlatan aydınlatma metnini okumanız, sağlık verileriniz için açık rıza vermeniz ve kullanım koşullarını kabul etmeniz gerekir.",
    sec1: "1 · Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni ve Açık Rıza",
    sec2: "2 · Kullanım Koşulları ve Hizmet Sözleşmesi",
    read: "Aydınlatma metnini okudum; sağlık verilerim dâhil özel nitelikli kişisel verilerimin madde 14'teki beyan kapsamında işlenmesine ve aktarılmasına AÇIK RIZAM vardır.",
    accept: "Kullanım Koşulları ve Hizmet Sözleşmesi'ni okudum ve kabul ediyorum.",
    button: "Onaylıyorum ve devam et",
    err: "Bir hata oluştu, lütfen tekrar deneyin.",
    proofBefore: "Onayınız zaman damgalı kayıt zincirine, okuduğunuz metnin özeti (hash) ile birlikte yazılır; kanıtını her zaman",
    proofLink: "Onay Kanıtı",
    proofAfter: "sayfasından görebilirsiniz.",
    open: "Ayrı sayfada aç",
    tr: "Türkçe",
    en: "English",
    courtesy: "Bu çeviri bilgilendirme amaçlıdır; hukuken bağlayıcı metin Türkçe (ikincil İngilizce) kanonik metindir — aşağıda açılabilir. Onayınız kanonik metne, okuduğunuz çevirinin dili ve özeti (hash) ise kayda ayrıca yazılır.",
    canonical: "Bağlayıcı metin (İngilizce)",
    partial: "Bazı paragraflar henüz çevrilemedi ve Türkçe görünüyor.",
    auto: "Otomatik çeviri (yapay zekâ). Henüz hukuki incelemeden geçmedi.",
    reviewed: "İncelenmiş çeviri. Hukuki inceleme tarihi:",
  },
  en: {
    title: "Privacy Notice and Explicit Consent · Terms of Use",
    sub: `Version ${AURA_LEGAL_VERSION} · ${AURA_LEGAL_DATE_LABEL.en} · given once, not asked again at every sign-in`,
    intro: "To provide the service we need you to read the privacy notice describing how your personal data are processed, give explicit consent for your health data and accept the terms of use.",
    sec1: "1 · Privacy Notice on the Processing of Personal Data and Explicit Consent",
    sec2: "2 · Terms of Use and Service Agreement",
    read: "I have read the privacy notice; I GIVE MY EXPLICIT CONSENT to the processing and transfer of my special-category personal data, including my health data, within the scope of the declaration in Section 14.",
    accept: "I have read and accept the Terms of Use and Service Agreement.",
    button: "I agree, continue",
    err: "Something went wrong, please try again.",
    proofBefore: "Your consent is written to a time-stamped record chain together with a hash of the text you read; you can always see the proof on the",
    proofLink: "Consent Proof",
    proofAfter: "page.",
    open: "Open in a new page",
    tr: "Türkçe",
    en: "English",
    courtesy: "This translation is informational; the legally binding text is the Turkish (secondary English) canonical text, expandable below. Your consent binds the canonical text; the language and hash of the translation you read are recorded alongside.",
    canonical: "Binding text (English)",
    partial: "Some paragraphs could not be translated yet and appear in Turkish.",
    auto: "Automatic translation (AI). Not yet legally reviewed.",
    reviewed: "Reviewed translation. Legal review date:",
  },
};

export const CONSENT_GATE_UI_TR_VALUES: readonly string[] = Object.values(CONSENT_GATE_UI.tr);
