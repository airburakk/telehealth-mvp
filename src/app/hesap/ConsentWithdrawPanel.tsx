"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldOff, Loader2, ShieldCheck } from "lucide-react";
import { REVOCABLE_LABEL, type RevocableScope } from "@/lib/aura-consent-texts";
import type { ConsentLang } from "@/lib/consent-lang";

// Hesabım → "Rızalarım" (kod Paket B, v6.269 · 2026-09-13): geri alınabilir açık rızaların durumu + geri alma.
// A01 madde 12 / A04: "rızanızı dilediğiniz zaman geri alabilirsiniz; geri alma o ana kadar yapılmış işlemi etkilemez".
// Geri alma → POST /api/consent/revoke (ispatlı kayıt); sonraki başvuru/görüşme/beyan formunda rıza yeniden istenir.
// Genel KVKK açık rızasının geri alınması hizmetin sona ermesidir → alttaki hesap silme paneli.
export interface ConsentItem {
  scope: RevocableScope;
  active: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

const UI: Record<ConsentLang, { title: string; sub: string; active: string; revoked: string; outdated: string; none: string; revoke: string; busy: string; granted: string; revokedOn: string; err: string; proof: string; general: string }> = {
  tr: {
    title: "Rızalarım",
    sub: "Ayrı kapsamlarda verdiğiniz açık rızaların durumu. Geri alma, o ana kadar yapılmış işlemi etkilemez; ilgili adımda rızanız yeniden istenir.",
    active: "Aktif", revoked: "Geri alındı", outdated: "Eski sürüm — yeniden istenecek", none: "Verilmedi", revoke: "Geri al", busy: "Kaydediliyor…",
    granted: "Verildi", revokedOn: "Geri alındı", err: "Geri alma kaydedilemedi, lütfen tekrar deneyin.",
    proof: "Onay Kanıtı", general: "Genel KVKK açık rızanızı geri almak hizmetin sona ermesi anlamına gelir; bunun için aşağıdaki hesap silme akışını kullanın.",
  },
  en: {
    title: "My consents",
    sub: "Status of the explicit consents you gave in separate scopes. Withdrawal does not affect processing carried out until now; your consent will be requested again at the relevant step.",
    active: "Active", revoked: "Withdrawn", outdated: "Outdated — will be asked again", none: "Not given", revoke: "Withdraw", busy: "Saving…",
    granted: "Given", revokedOn: "Withdrawn", err: "Withdrawal could not be recorded, please try again.",
    proof: "Consent Proof", general: "Withdrawing your general KVKK explicit consent means ending the service; use the account deletion flow below for that.",
  },
};

export function ConsentWithdrawPanel({ lang, items: initial }: { lang: ConsentLang; items: ConsentItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<RevocableScope | null>(null);
  const [err, setErr] = useState("");
  const ui = UI[lang];
  const fmt = (iso: string) => new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));

  async function revoke(scope: RevocableScope) {
    setBusy(scope);
    setErr("");
    try {
      const r = await fetch("/api/consent/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, lang }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error();
      setItems((prev) => prev.map((it) => (it.scope === scope ? { ...it, active: false, revokedAt: data.revokedAt ?? new Date().toISOString() } : it)));
    } catch {
      setErr(ui.err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section lang={lang} dir="ltr" className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--c-ink)]"><ShieldCheck size={18} /> {ui.title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{ui.sub}</p>
      <ul className="mt-4 space-y-2.5">
        {items.map((it) => {
          // Durum: aktif · geri alındı (son geri alma vermeden sonra) · eski sürüm (verme var, geri alma yok — metin v2 → yeniden istenir) · verilmedi
          const revoked = !it.active && !!it.revokedAt && (!it.grantedAt || new Date(it.revokedAt) >= new Date(it.grantedAt));
          const status = it.active ? ui.active : revoked ? ui.revoked : it.grantedAt ? ui.outdated : ui.none;
          const tone = it.active ? "bg-emerald-500/10 text-emerald-300" : revoked ? "bg-amber-500/10 text-amber-300" : "bg-[var(--c-surface)] text-[var(--c-ink-3)]";
          return (
            <li key={it.scope} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--c-ink)]">{REVOCABLE_LABEL[it.scope][lang]}</div>
                <div className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">
                  {it.grantedAt ? `${ui.granted}: ${fmt(it.grantedAt)}` : ""}
                  {revoked && it.revokedAt ? ` · ${ui.revokedOn}: ${fmt(it.revokedAt)}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{status}</span>
                {it.active && (
                  <button
                    type="button"
                    onClick={() => revoke(it.scope)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-50"
                  >
                    {busy === it.scope ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />} {busy === it.scope ? ui.busy : ui.revoke}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        {ui.general}{" "}
        <Link href="/onam/kanit" className="underline underline-offset-2">{ui.proof}</Link>
      </p>
    </section>
  );
}
