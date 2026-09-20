"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { leaveConsentGate } from "./leave-gate";
import { ShieldCheck, Loader2, ArrowRight, FileText, ScrollText, ChevronDown, Languages } from "lucide-react";
import { CONSENT_LANG_NOTE, type ConsentLang } from "@/lib/consent-lang";
import { CONSENT_GATE_UI, type ConsentGateUi } from "@/lib/aura-consent-gate-ui";
import { legalDir } from "@/lib/aura-legal/display";

// AURA HASTA onam kapısı (kod Paket B, v6.269 · 2026-09-13) — /onam "general" ekranı (PATIENT).
//
// EKRAN = HASH (S10): gösterilen kanonik gövde, sunucunun ConsentRecord'a hash'lediği markdown'ın kendisidir — sayfa (server)
// LegalMarkdown düğümlerini TR ve EN için prop olarak geçirir; burada yalnız seçili dil sarmalanır. İki kapsam tek
// ekranda: A01 aydınlatma + madde 14 açık rıza beyanı (GENERAL_KVKK v4) ve A02 kullanım koşulları (AURA_TERMS v1);
// ikisi de işaretlenmeden düğme açılmaz.
//
// Paket 7 (v6.285, 👤 karar A — hukuki metin tam lokalizasyon): hastanın dili TR/EN dışıysa sayfa `courtesy` geçirir —
// BİLGİLENDİRME ÇEVİRİSİ birincil okuma olur (gövde hastanın dilinde, arayüz dizeleri de), her bölümün altında kanonik EN
// metin açılır; onay POST'u yine kanonik EN'i hash'ler (`lang: "en"`) ve gösterilen çevirinin dili + hash'lerini `shown`
// olarak ekler (ConsentRecord.shownLang/shownTextHash — ispat: hasta hangi metni okudu). Çipler: Türkçe · English · <dil>.
export type ConsentCourtesy = {
  lang: string; // dil adı ("Rusça")
  code: string; // ru
  partial: boolean;
  aydinlatma: ReactNode;
  kosullar: ReactNode;
  hashes: { aydinlatmaHash: string; kosullarHash: string };
  status: Record<"aydinlatma" | "kosullar", CourtesyDocStatus>; // 7-C (v6.286): bölüm başı rozeti — onaylı (dondurulmuş) / otomatik
  ui: Record<string, string>; // CONSENT_GATE_UI.tr değerleri → gösterim dili
};

export type CourtesyDocStatus = { status: "automatic" | "reviewed"; reviewedAt: string | null };

type View = ConsentLang | "courtesy";

// 7-C (v6.286): bölüm başı rozeti — hukukçu onaylı (dondurulmuş) çeviri mi, otomatik mi; hasta hangi metni okuduğunu bilsin.
function CourtesyStatus({ s, ui, code }: { s: CourtesyDocStatus; ui: ConsentGateUi; code: string }) {
  const at = s.status === "reviewed" ? s.reviewedAt : null;
  return (
    <p
      className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        at ? "border-[var(--c-success)]/40 text-[var(--c-success)]" : "border-[var(--c-hairline)] text-[var(--c-ink-3)]"
      }`}
    >
      {at ? (
        <>
          {ui.reviewed} <time dateTime={at}>{new Intl.DateTimeFormat(code, { dateStyle: "long" }).format(new Date(at))}</time>
        </>
      ) : (
        ui.auto
      )}
    </p>
  );
}

function courtesyUi(map: Record<string, string>): ConsentGateUi {
  const tr = CONSENT_GATE_UI.tr;
  return Object.fromEntries(Object.entries(tr).map(([k, v]) => [k, map[v] ?? v])) as ConsentGateUi;
}

export function AuraConsentGate({
  dest, initialLang, aydinlatma, kosullar, courtesy = null,
}: {
  dest: string;
  initialLang: ConsentLang;
  aydinlatma: Record<ConsentLang, ReactNode>;
  kosullar: Record<ConsentLang, ReactNode>;
  courtesy?: ConsentCourtesy | null;
}) {
  const [view, setView] = useState<View>(courtesy ? "courtesy" : initialLang);
  const [readInfo, setReadInfo] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const inCourtesy = view === "courtesy" && !!courtesy;
  const lang: ConsentLang = view === "courtesy" ? "en" : view; // KANONİK (hash'lenen) dil — çeviri görünümünde EN
  const ui = useMemo(() => (inCourtesy && courtesy ? courtesyUi(courtesy.ui) : CONSENT_GATE_UI[lang]), [inCourtesy, courtesy, lang]);
  const htmlLang = inCourtesy && courtesy ? courtesy.code : lang;
  const dir = inCourtesy && courtesy ? legalDir(courtesy.code) : "ltr";

  function switchView(v: View) {
    if (v === view) return;
    setView(v);
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
        body: JSON.stringify({
          kind: "general",
          lang,
          ...(inCourtesy && courtesy ? { shown: { lang: courtesy.lang, ...courtesy.hashes } } : {}),
        }),
      });
      if (!r.ok) throw new Error();
      leaveConsentGate(dest); // TAM SAYFA — router.push üretimde bayat ön-yükleme önbelleğiyle /onam'a geri dönüyordu (leave-gate.ts)
    } catch {
      setErr(ui.err);
      setSubmitting(false);
    }
  }

  const docHref = (path: string) => (inCourtesy && courtesy ? `${path}?lang=${courtesy.code}` : lang === "en" ? `${path}?lang=en` : path);
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"}`;

  return (
    <div lang={htmlLang} dir={dir} className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><ShieldCheck size={22} /></span>
          <div>
            <h1 className="aura-display text-2xl font-medium tracking-tight text-[var(--c-ink)]">{ui.title}</h1>
            <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">{ui.sub}</p>
          </div>
        </div>
        <div role="group" aria-label="Türkçe / English" className="flex shrink-0 flex-wrap gap-1 rounded-full border border-[var(--c-hairline)] p-0.5">
          {courtesy && (
            <button type="button" onClick={() => switchView("courtesy")} aria-pressed={inCourtesy} className={chip(inCourtesy)}>
              {courtesy.lang}
            </button>
          )}
          {(["tr", "en"] as const).map((l) => (
            <button key={l} type="button" onClick={() => switchView(l)} aria-pressed={view === l} className={chip(view === l)}>
              {CONSENT_GATE_UI.tr[l]}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-[var(--c-ink-2)]">{ui.intro}</p>
      {inCourtesy && courtesy ? (
        <div className="mt-2 flex items-start gap-2 rounded-2xl border border-[var(--c-accent)]/40 bg-[var(--c-accent)]/[0.08] px-4 py-3 text-[12px] leading-relaxed text-[var(--c-ink)]">
          <Languages size={15} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
          <span>
            {ui.courtesy}
            {courtesy.partial && <> {ui.partial}</>}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--c-ink-3)]">{CONSENT_LANG_NOTE[lang]}</p>
      )}

      <Section icon={<FileText size={16} />} title={ui.sec1} href={docHref("/aydinlatma")} open={ui.open}>
        {inCourtesy && courtesy ? (
          <>
            <CourtesyStatus s={courtesy.status.aydinlatma} ui={ui} code={courtesy.code} />
            {courtesy.aydinlatma}
            <Canonical label={ui.canonical}>{aydinlatma.en}</Canonical>
          </>
        ) : aydinlatma[lang]}
      </Section>
      <Section icon={<ScrollText size={16} />} title={ui.sec2} href={docHref("/kosullar")} open={ui.open}>
        {inCourtesy && courtesy ? (
          <>
            <CourtesyStatus s={courtesy.status.kosullar} ui={ui} code={courtesy.code} />
            {courtesy.kosullar}
            <Canonical label={ui.canonical}>{kosullar.en}</Canonical>
          </>
        ) : kosullar[lang]}
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

// Kanonik (hash'lenen) EN metin — çeviri görünümünde her bölümün altında açılır; yönü daima ltr/en.
function Canonical({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mt-4 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)]" lang="en" dir="ltr">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold text-[var(--c-ink-2)]">
        <span>{label}</span>
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--c-hairline)] px-3 py-2">{children}</div>
    </details>
  );
}
