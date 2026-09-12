"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, ArrowRight, FileText, ScrollText } from "lucide-react";
import { AURA_LEGAL_DATE_LABEL, AURA_LEGAL_VERSION } from "@/lib/aura-legal/routes";
import { CONSENT_LANG_NOTE, type ConsentLang } from "@/lib/consent-lang";

// AURA HASTA onam kapısı (kod Paket B, v6.269 · 2026-09-13) — /onam "general" ekranı (PATIENT).
//
// EKRAN = HASH (S10): gösterilen gövde, sunucunun ConsentRecord'a hash'lediği markdown'ın kendisidir — sayfa (server)
// LegalMarkdown düğümlerini TR ve EN için prop olarak geçirir; burada yalnız seçili dil sarmalanır. İki kapsam tek
// ekranda: A01 aydınlatma + madde 14 açık rıza beyanı (GENERAL_KVKK v4, "okudum + açık rızam vardır") ve A02 kullanım
// koşulları (AURA_TERMS v1, "okudum ve kabul ediyorum"); ikisi de işaretlenmeden düğme açılmaz. Dil TR/EN (S4: hash dil
// başına); Türkçe dışındaki arayüz dillerinde İngilizce kanonik açılır ve "çelişkide TR esastır" notu görünür.
// Eski ConsentGate (özet maddeler + taslak) bu kapıyla SÜPERSEDE edildi: hasta yüzünde özet değil tam metin okunur.
const UI: Record<ConsentLang, {
  title: string; sub: string; intro: string; sec1: string; sec2: string; read: string; accept: string; button: string;
  err: string; proofBefore: string; proofLink: string; proofAfter: string; open: string; tr: string; en: string;
}> = {
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
  },
};

export function AuraConsentGate({
  dest, initialLang, aydinlatma, kosullar,
}: {
  dest: string;
  initialLang: ConsentLang;
  aydinlatma: Record<ConsentLang, ReactNode>;
  kosullar: Record<ConsentLang, ReactNode>;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<ConsentLang>(initialLang);
  const [readInfo, setReadInfo] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const ui = UI[lang];

  function switchLang(l: ConsentLang) {
    if (l === lang) return;
    setLang(l);
    setReadInfo(false); // metin değişti → yeniden okunup işaretlenir (hash o dilin metnidir)
    setAcceptTerms(false);
  }

  async function accept() {
    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "general", lang }),
      });
      if (!r.ok) throw new Error();
      router.push(dest);
      router.refresh();
    } catch {
      setErr(ui.err);
      setSubmitting(false);
    }
  }

  return (
    <div lang={lang} dir="ltr" className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><ShieldCheck size={22} /></span>
          <div>
            <h1 className="aura-display text-2xl font-medium tracking-tight text-[var(--c-ink)]">{ui.title}</h1>
            <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">{ui.sub}</p>
          </div>
        </div>
        <div role="group" aria-label="Türkçe / English" className="flex shrink-0 gap-1 rounded-full border border-[var(--c-hairline)] p-0.5">
          {(["tr", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => switchLang(l)}
              aria-pressed={l === lang}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${l === lang ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"}`}
            >
              {ui[l]}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-[var(--c-ink-2)]">{ui.intro}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--c-ink-3)]">{CONSENT_LANG_NOTE[lang]}</p>

      <Section icon={<FileText size={16} />} title={ui.sec1} href={lang === "en" ? "/aydinlatma?lang=en" : "/aydinlatma"} open={ui.open}>
        {aydinlatma[lang]}
      </Section>
      <Section icon={<ScrollText size={16} />} title={ui.sec2} href={lang === "en" ? "/kosullar?lang=en" : "/kosullar"} open={ui.open}>
        {kosullar[lang]}
      </Section>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
        <input type="checkbox" checked={readInfo} onChange={(e) => setReadInfo(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
        <span className="text-[13px] leading-relaxed text-[var(--c-ink)]">{ui.read}</span>
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
        <span className="text-[13px] leading-relaxed text-[var(--c-ink)]">{ui.accept}</span>
      </label>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button
        onClick={accept}
        disabled={!readInfo || !acceptTerms || submitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-5 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {ui.button}
      </button>
      <p className="mt-3 text-center text-[11px] text-[var(--c-ink-3)]">
        {ui.proofBefore}{" "}
        <Link href="/onam/kanit" className="underline underline-offset-2">{ui.proofLink}</Link>
        {" "}{ui.proofAfter}
      </p>
    </div>
  );
}

function Section({ icon, title, href, open, children }: { icon: ReactNode; title: string; href: string; open: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--c-hairline)] px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--c-ink)]">{icon} {title}</h2>
        <a href={href} target="_blank" rel="noopener" className="text-[11px] text-[var(--c-ink-3)] underline underline-offset-2 hover:text-[var(--c-ink-2)]">{open}</a>
      </div>
      <div className="max-h-80 overflow-y-auto px-4 py-3 text-[13px]">{children}</div>
    </section>
  );
}
