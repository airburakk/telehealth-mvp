"use client";

import { useState } from "react";
import { PhoneCall, Check, Loader2, Undo2 } from "lucide-react";

// AŞAMA 2 — klinik telefonu geri-arama teyidi bloğu (v6.127; koordinatör/admin yüzü).
// İNSAN-İŞLETİMLİ katman: incelemeci, doktorun çalıştığı kurumun HealthTürkiye'deki RESMÎ
// numarasını KENDİSİ arar; telefonda teyit ettikten sonra tesis adını yazıp damgalar
// (POST /api/admin/doctors/[id]/clinic-phone → audit CLINIC_PHONE_VERIFY). Yanlış teyit
// "Geri al" ile düşürülür (DELETE, audit'li). Otomasyon BİLİNÇLİ YOK — katmanın değeri
// insan teyidinde (vault doktor-kimlik-dogrulama §8.2).

export function ClinicPhoneVerify({
  doctorId,
  initialVerified,
  initialEstablishment,
}: {
  doctorId: string;
  initialVerified: boolean;
  initialEstablishment: string | null;
}) {
  const [verified, setVerified] = useState(initialVerified);
  const [est, setEst] = useState(initialEstablishment ?? "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function stamp() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`/api/admin/doctors/${doctorId}/clinic-phone`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishment: input }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setVerified(true); setEst(input);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally { setBusy(false); }
  }

  async function revoke() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`/api/admin/doctors/${doctorId}/clinic-phone`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Geri alınamadı.");
      setVerified(false); setInput(est); setEst("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-3 border-t border-[var(--c-hairline)] pt-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
        <PhoneCall size={12} /> Klinik telefonu teyidi (Aşama 2 kurum bağı)
      </div>
      {verified ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
            <Check size={13} /> Teyit edildi{est ? ` — ${est}` : ""}
          </span>
          <button type="button" onClick={revoke} disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--c-ink-2)] hover:border-red-400/40 hover:text-red-300 disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Geri al
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
            Doktorun kurumunu HealthTürkiye dizinindeki <strong>resmî tesis numarasından</strong> arayıp
            kendisini teyit edin; sonra tesisin dizindeki adını yazıp damgalayın. Karar denetim
            zincirine (CLINIC_PHONE_VERIFY) sizin adınızla yazılır.
          </p>
          <div className="mt-2 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Teyit edilen tesisin adı (HealthTürkiye kaydındaki)"
              className="w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-1.5 text-xs text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)] focus:outline-none" />
            <button type="button" onClick={stamp} disabled={busy || !input.trim()}
              className="shrink-0 rounded-xl bg-[var(--c-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)] disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Aradım, teyit ettim"}
            </button>
          </div>
        </>
      )}
      {err && <p className="mt-1.5 text-xs text-red-300">{err}</p>}
    </div>
  );
}
