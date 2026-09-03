"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, ArrowRight, FileText, ScrollText, GraduationCap } from "lucide-react";
import { DOCTORIUM_LEGAL_DATE_TR, DOCTORIUM_LEGAL_VERSION } from "@/lib/doctorium-legal";

// Doctorium onam kapısı (v6.211 · 2026-09-03; 👤 karar 15 §7 — Seçenek A + C).
//
// Doctorium'dan kayıt olan doktor/öğrenci telesağlık metnini değil, Doctorium'un kendi aydınlatmasını
// (belge 01) ve üyelik sözleşmesini (belge 02) görür. EKRAN = HASH: gösterilen gövde, sunucunun
// ConsentRecord'a hash'lediği markdown metninin (lib/doctorium-legal texts) kendisidir — sayfa (server)
// LegalMarkdown'ı prop olarak geçirir, burada yalnız sarmalanır. Aydınlatma "okudum" (bilgilendirme),
// sözleşme "okudum ve kabul ediyorum" (irade beyanı); ikisi de işaretlenmeden düğme açılmaz.
// Öğrencide aydınlatmanın hemen ardından öğrenci eki (belge 07 §A) gösterilir — ayrı onay kaydı yoktur,
// aydınlatma niteliğindedir (Kılavuz §2).
export function DoctoriumConsentGate({
  dest, student, aydinlatma, ogrenciEki, kosullar,
}: {
  dest: string;
  student: boolean;
  aydinlatma: ReactNode;
  ogrenciEki?: ReactNode;
  kosullar: ReactNode;
}) {
  const router = useRouter();
  const [readInfo, setReadInfo] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "doctorium" }) });
      if (!r.ok) throw new Error();
      router.push(dest);
      router.refresh();
    } catch {
      setErr("Bir hata oluştu, lütfen tekrar deneyin.");
      setSubmitting(false);
    }
  }

  return (
    <div lang="tr" className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><ShieldCheck size={22} /></span>
        <div>
          <h1 className="aura-display text-2xl font-medium tracking-tight text-[var(--c-ink)]">Doctorium — Aydınlatma ve Üyelik Sözleşmesi</h1>
          <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">Sürüm {DOCTORIUM_LEGAL_VERSION} · {DOCTORIUM_LEGAL_DATE_TR} · bir kez onaylanır, her girişte yeniden sorulmaz</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-[var(--c-ink-2)]">
        Doctorium&apos;u kullanabilmeniz için kişisel verilerinizin nasıl işlendiğini anlatan aydınlatma metnini okumanız
        ve üyelik sözleşmesini kabul etmeniz gerekir. Doctorium&apos;da hasta verisi işlenmez; bu metinler yalnız
        Doctorium üyeliğinizi kapsar.
      </p>

      <Section icon={<FileText size={16} />} title="1 · Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni" href="/doctorium/aydinlatma">
        {aydinlatma}
      </Section>
      {student && ogrenciEki && (
        <Section icon={<GraduationCap size={16} />} title="Tıp Öğrencisi Üyeliği Ek Metni">
          {ogrenciEki}
        </Section>
      )}
      <Section icon={<ScrollText size={16} />} title={`${student ? "2" : "2"} · Üyelik Sözleşmesi ve Kullanım Koşulları`} href="/doctorium/kosullar">
        {kosullar}
      </Section>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
        <input type="checkbox" checked={readInfo} onChange={(e) => setReadInfo(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
        <span className="text-[13px] leading-relaxed text-[var(--c-ink)]">
          Aydınlatma metnini{student ? " ve tıp öğrencisi üyeliği ek metnini" : ""} okudum; Doctorium&apos;da kişisel verilerimin bu metinde belirtilen amaç, hukuki sebep ve sürelerle işleneceği konusunda bilgilendirildim.
        </span>
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
        <span className="text-[13px] leading-relaxed text-[var(--c-ink)]">
          Üyelik Sözleşmesi ve Kullanım Koşulları&apos;nı okudum ve <strong>kabul ediyorum</strong>; Doctorium&apos;u mesleki faaliyetim kapsamında kullanacağımı beyan ederim.
        </span>
      </label>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button
        onClick={accept}
        disabled={!readInfo || !acceptTerms || submitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-5 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Onaylıyorum ve devam et
      </button>
      <p className="mt-3 text-center text-[11px] text-[var(--c-ink-3)]">
        Onayınız zaman damgalı kayıt zincirine, okuduğunuz metnin özeti (hash) ile birlikte yazılır; kanıtını her zaman{" "}
        <Link href="/onam/kanit" className="underline underline-offset-2">Onay Kanıtı</Link> sayfasından görebilirsiniz.
      </p>
    </div>
  );
}

function Section({ icon, title, href, children }: { icon: ReactNode; title: string; href?: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--c-hairline)] px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--c-ink)]">{icon} {title}</h2>
        {href && <a href={href} target="_blank" rel="noopener" className="text-[11px] text-[var(--c-ink-3)] underline underline-offset-2 hover:text-[var(--c-ink-2)]">Ayrı sayfada aç</a>}
      </div>
      <div className="max-h-72 overflow-y-auto px-4 py-3 text-[13px]">{children}</div>
    </section>
  );
}
