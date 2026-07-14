"use client";

import { useState } from "react";
import { Send, Video, Check } from "lucide-react";

// Doktorun sağlık turizmi havuzundaki bir vakaya tanıtım mesajı + opsiyonel video randevu teklifi
// göndermesi. POST /api/cases/:id/tourism-outreach. Çoklu gönderim serbest (her biri ayrı outreach).
export function TourismOutreachForm({
  caseId,
  previous,
}: {
  caseId: string;
  previous: { status: string; proposedAt: string | null }[];
}) {
  const [message, setMessage] = useState("");
  const [withVideo, setWithVideo] = useState(false);
  const [proposedAt, setProposedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [err, setErr] = useState("");

  const accepted = previous.some((p) => p.status === "ACCEPTED");

  async function send() {
    if (!message.trim()) { setErr("Lütfen bir tanıtım mesajı yazın."); return; }
    if (withVideo && !proposedAt) { setErr("Video görüşme için bir tarih/saat seçin."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/cases/${caseId}/tourism-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), proposedAt: withVideo ? proposedAt : null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gönderilemedi.");
      setSentCount((n) => n + 1);
      setMessage(""); setWithVideo(false); setProposedAt("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[var(--c-hairline)] pt-3">
      {(previous.length > 0 || sentCount > 0) && (
        <div className="mb-2 text-xs text-[var(--c-ink-3)]">
          Bu vakaya {previous.length + sentCount} mesaj/teklif gönderdiniz
          {accepted ? " · ✓ video teklifiniz kabul edildi" : ""}.
        </div>
      )}
      {accepted ? (
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--c-success)]">
          <Check size={15} /> Hasta teklifinizi kabul etti — randevu saatinde görüşme odasında olun.
        </div>
      ) : (
        <>
          {sentCount > 0 && (
            <div className="mb-2 flex items-center gap-1.5 text-sm text-[var(--c-success)]">
              <Check size={15} /> Gönderildi. Hasta bekleme ekranında görecek.
            </div>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Kendinizi ve tedavi yaklaşımınızı kısaca tanıtın; hastayı görüşmeye davet edin…"
            className="inp"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-[var(--c-ink-2)]">
            <input type="checkbox" checked={withVideo} onChange={(e) => setWithVideo(e.target.checked)} className="h-4 w-4" />
            <Video size={15} className="text-[var(--c-accent-strong)]" /> Video görüşme randevusu öner
          </label>
          {withVideo && (
            <input
              type="datetime-local"
              value={proposedAt}
              onChange={(e) => setProposedAt(e.target.value)}
              className="inp mt-2"
            />
          )}
          {err && <div className="mt-1 text-xs text-[var(--c-danger)]">{err}</div>}
          <button
            onClick={send}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
          >
            <Send size={14} /> {busy ? "Gönderiliyor…" : withVideo ? "Mesaj + video teklifi gönder" : "Mesaj gönder"}
          </button>
        </>
      )}
    </div>
  );
}
