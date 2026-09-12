"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, ArrowRight, UserCheck } from "lucide-react";
import { AURA_LEGAL_DATE_LABEL, AURA_LEGAL_VERSION } from "@/lib/aura-legal/routes";
import { CONSENT_LANG_NOTE, type ConsentLang } from "@/lib/consent-lang";

// AURA PERSONEL onam kapısı (kod Paket B, v6.269 · 2026-09-13) — /onam "general" (personel rolleri) ve "clinical"
// (DOCTOR, Aşama 2 klinik aktivasyon) ekranları. Kapsam STAFF_KVKK v1 = A09 personel aydınlatması + ROL KESİTİ:
// madde 10'da yalnız rolün maddesi (lib/aura-consent-texts staffKvkkText) — R17 "rol ekleri kanonik metne";
// hash rol × dil. Sayfa (server) kesitin LegalMarkdown düğümünü TR/EN prop olarak geçirir (ekran = hash).
// Eski ConsentGate STAFF özeti + STAFF_ROLE_EXTRA satırları bu kapıyla SÜPERSEDE edildi.
const ROLE_LABEL: Record<string, Record<ConsentLang, string>> = {
  DOCTOR: { tr: "Doktor — Aşama 2 klinik aktivasyon", en: "Doctor — Stage 2 clinical activation" },
  COORDINATOR: { tr: "Koordinatör", en: "Coordinator" },
  ETHICS: { tr: "Etik Kurul üyesi", en: "Ethics Board member" },
  ADMIN: { tr: "Yönetici", en: "Administrator" },
  AGENCY: { tr: "Sağlık Turizmi Acentesi", en: "Health Tourism Agency" },
  PARTNER: { tr: "Partner Doktor", en: "Partner Doctor" },
  HEALTH_PRO: { tr: "Sağlık Uzmanı", en: "Health Professional" },
};

const UI: Record<ConsentLang, {
  title: string; sub: string; intro: string; clinical: string; section: string; role: string; accept: string; button: string;
  err: string; proofBefore: string; proofLink: string; proofAfter: string; tr: string; en: string;
}> = {
  tr: {
    title: "Personel Aydınlatma Metni ve Rol Maddesi",
    sub: `Sürüm ${AURA_LEGAL_VERSION} · ${AURA_LEGAL_DATE_LABEL.tr} · bir kez onaylanır; rolünüzün erişim kapsamı değişirse yeniden sorulur`,
    intro: "Platformda hasta dışı bir rolle çalışabilmeniz için kişisel verilerinizin nasıl işlendiğini anlatan aydınlatma metnini ve rolünüze ait erişim/gizlilik maddesini okumanız gerekir.",
    clinical: "Aşama 2 — klinik aktivasyon. Doctorium üyeliğiniz için verdiğiniz onam yeterlidir; klinik yüzeylere (vaka havuzu, görüşme, post-op takip) geçebilmeniz için hasta verisi kapsamındaki bu aydınlatmayı ve doktor rol maddesini de onaylamanız gerekir. Onaylamazsanız Doctorium'u aynı şekilde kullanmaya devam edersiniz.",
    section: "Personel ve Doktor (Aşama 2) Aydınlatma Metni",
    role: "Rolünüz",
    accept: "Aydınlatma metnini ve rolüme ait madde 10 maddesini okudum; kişisel verilerimin bu metinde belirtilen amaç, hukuki sebep ve sürelerle işleneceği konusunda bilgilendirildim ve rol maddesindeki erişim sınırı ile gizlilik yükümlülüklerini kabul ediyorum.",
    button: "Onaylıyorum ve devam et",
    err: "Bir hata oluştu, lütfen tekrar deneyin.",
    proofBefore: "Onayınız zaman damgalı kayıt zincirine, okuduğunuz metnin özeti (hash) ile birlikte yazılır; kanıtını her zaman",
    proofLink: "Onay Kanıtı",
    proofAfter: "sayfasından görebilirsiniz.",
    tr: "Türkçe",
    en: "English",
  },
  en: {
    title: "Staff Privacy Notice and Role Clause",
    sub: `Version ${AURA_LEGAL_VERSION} · ${AURA_LEGAL_DATE_LABEL.en} · given once; asked again if your role's access scope changes`,
    intro: "To work on the platform in a non-patient role you need to read the privacy notice describing how your personal data are processed and the access/confidentiality clause for your role.",
    clinical: "Stage 2 — clinical activation. Your Doctorium consent is sufficient for Doctorium; to access the clinical surfaces (case pool, consultations, post-operative follow-up) you must also approve this notice covering patient data and the doctor role clause. If you do not, you can keep using Doctorium as before.",
    section: "Staff and Doctor (Stage 2) Privacy Notice",
    role: "Your role",
    accept: "I have read the privacy notice and the Section 10 clause for my role; I have been informed that my personal data will be processed for the purposes, legal grounds and periods stated, and I accept the access limits and confidentiality obligations in the role clause.",
    button: "I agree, continue",
    err: "Something went wrong, please try again.",
    proofBefore: "Your consent is written to a time-stamped record chain together with a hash of the text you read; you can always see the proof on the",
    proofLink: "Consent Proof",
    proofAfter: "page.",
    tr: "Türkçe",
    en: "English",
  },
};

export function StaffConsentGate({
  dest, role, clinical = false, initialLang = "tr", text,
}: {
  dest: string;
  role: string;
  clinical?: boolean;
  initialLang?: ConsentLang;
  /** A09 rol kesiti (LegalMarkdown) — TR ve EN; gösterilen = hash'lenen. */
  text: Record<ConsentLang, ReactNode>;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<ConsentLang>(initialLang);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const ui = UI[lang];
  const roleLabel = ROLE_LABEL[role]?.[lang] ?? role;

  function switchLang(l: ConsentLang) {
    if (l === lang) return;
    setLang(l);
    setAgreed(false);
  }

  async function accept() {
    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "staff", lang }),
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

      {clinical && (
        <p className="mt-4 rounded-2xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/[0.08] px-4 py-3 text-[13px] leading-relaxed text-[var(--c-ink)]">
          {ui.clinical}
        </p>
      )}
      <p className="mt-5 text-sm leading-relaxed text-[var(--c-ink-2)]">{ui.intro}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--c-surface)] px-3 py-1 text-[12px] text-[var(--c-ink-2)]">
        <UserCheck size={13} /> {ui.role}: <strong className="text-[var(--c-ink)]">{roleLabel}</strong>
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--c-ink-3)]">{CONSENT_LANG_NOTE[lang]}</p>

      <section className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)]">
        <div className="border-b border-[var(--c-hairline)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-[var(--c-ink)]">{ui.section}</h2>
        </div>
        <div className="max-h-96 overflow-y-auto px-4 py-3 text-[13px]">{text[lang]}</div>
      </section>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
        <span className="text-[13px] leading-relaxed text-[var(--c-ink)]">{ui.accept}</span>
      </label>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button
        onClick={accept}
        disabled={!agreed || submitting}
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
