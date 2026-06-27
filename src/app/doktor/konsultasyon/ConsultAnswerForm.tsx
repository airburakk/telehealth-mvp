"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";

// M5 Faz 2 — Anonim konsültasyon talebine görüş yazma formu (per-kart).
export function ConsultAnswerForm({ id }: { id: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!text.trim()) { setErr("Görüş metni boş olamaz."); return; }
    setSending(true);
    setErr("");
    try {
      const r = await fetch(`/api/consultation-requests/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gönderilemedi.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#818cf8] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#6d75e0]">
        <Send size={14} /> Görüş ver
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(""); }}
        rows={4}
        placeholder="Klinik görüşünüzü yazın (anonim dosya üzerinden)…"
        className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-[#818cf8]"
      />
      {err && <p className="mt-1.5 text-sm text-red-600">{err}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button onClick={submit} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#818cf8] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#6d75e0] disabled:opacity-60">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Gönder
        </button>
        <button onClick={() => { setOpen(false); setText(""); setErr(""); }} disabled={sending} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">İptal</button>
      </div>
    </div>
  );
}
