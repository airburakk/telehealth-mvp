"use client";

import { useState } from "react";
import { Plane, Video, Check, X, Loader2 } from "lucide-react";

type Outreach = { id: string; doctorName: string; message: string; proposedAtLabel: string | null; status: string };

// Hasta-yüzü sağlık turizmi bekleme + gelen doktor mesaj/teklifleri (2026-07-14).
// 3-seçenek kapısının yerini alır: branş havuzu doktorlarının tanıtım mesajları + video randevu
// teklifleri; hasta bir teklifi kabul eder → o doktorla görüşme planlanır (mevcut consult akışı).
// (i18n MVP-sonrası: statik etiketler + doktor mesaj çevirisi ayrı tur — şimdilik TR.)
export function TourismInbox({
  caseId: _caseId,
  branchLabel,
  country,
  outreaches,
}: {
  caseId: string;
  branchLabel: string;
  country: string;
  outreaches: Outreach[];
}) {
  const [items, setItems] = useState(outreaches);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const accepted = items.some((o) => o.status === "ACCEPTED");

  async function respond(id: string, action: "accept" | "decline") {
    setBusyId(id); setErr("");
    try {
      const r = await fetch(`/api/tourism-outreach/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "İşlem başarısız.");
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status: action === "accept" ? "ACCEPTED" : "DECLINED" } : o)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-3xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/[0.08] p-5">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)]/15 text-[var(--c-accent-strong)]"><Plane size={18} /></span>
        <div>
          <h1 className="font-bold text-[var(--c-ink)]">Talebiniz {branchLabel} doktorlarına iletildi</h1>
          <p className="mt-0.5 text-sm text-[var(--c-ink-2)]">
            {country} için {branchLabel} branşındaki doktorlar talebinizi inceliyor. Size tanıtım mesajı gönderip
            video görüşme randevusu önerecekler. Gelen tekliflerden birini kabul ettiğinizde görüşme planlanır.
          </p>
        </div>
      </div>

      {accepted && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--c-success)]/30 bg-[var(--c-success)]/10 p-4 text-sm font-medium text-[var(--c-success)]">
          <Check size={16} /> Video görüşme teklifini kabul ettiniz. Randevu saatinde bu sayfadan görüşmeye katılabilirsiniz.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--c-hairline)] p-6 text-center text-sm text-[var(--c-ink-3)]">
          Henüz doktor mesajı yok — talebiniz doktorlar tarafından inceleniyor.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li key={o.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[var(--c-ink)]">{o.doctorName}</div>
                {o.status === "ACCEPTED" && <span className="rounded-full bg-[var(--c-success)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--c-success)]">Kabul edildi</span>}
                {o.status === "DECLINED" && <span className="text-xs text-[var(--c-ink-3)]">Reddedildi</span>}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--c-ink-2)]">{o.message}</p>
              {o.proposedAtLabel && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--c-accent-strong)]">
                  <Video size={13} /> Video görüşme önerisi: {o.proposedAtLabel}
                </div>
              )}
              {o.status === "SENT" && o.proposedAtLabel && !accepted && (
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => respond(o.id, "accept")} disabled={busyId === o.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
                    {busyId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kabul et
                  </button>
                  <button onClick={() => respond(o.id, "decline")} disabled={busyId === o.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm font-medium text-[var(--c-ink-2)] transition hover:bg-[var(--c-surface)] disabled:opacity-60">
                    <X size={14} /> Reddet
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {err && <div className="text-xs text-[var(--c-danger)]">{err}</div>}
    </div>
  );
}
