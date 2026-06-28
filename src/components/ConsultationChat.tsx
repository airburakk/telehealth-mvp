"use client";

// M5 Faz 2 — Konsültasyon yazılı görüşme (chat). Partner ↔ sahiplenen/yanıtlayan hekim.
// Mesaj gövdeleri sunucuda alıcı diline çevrilir (translated); burada yalnız chrome i18n + RTL.
// Poll tabanlı (WebSocket yok — serverless uyumlu, NotificationBell deseni).
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, MessagesSquare } from "lucide-react";
import { useT } from "@/components/useT";
import { langDir, LANG_BCP47 } from "@/lib/constants";

interface Msg { id: string; mine: boolean; senderRole: "PARTNER" | "DOCTOR"; text: string; createdAt: string }

const CHROME = [
  "Yazılı görüşme",
  "Mesaj yazın…",
  "Henüz mesaj yok.",
  "Uzman hekim bekleniyor — görüşme başlayınca yazabilirsiniz.",
  "İlk sorunuzu gönderdiğinizde bu talebi üstlenirsiniz.",
];

export function ConsultationChat({
  requestId,
  lang = "Türkçe",
  canSend = true,
  hintKey,
  compact = false,
}: {
  requestId: string;
  lang?: string;
  canSend?: boolean;
  hintKey?: string; // canSend=false iken gösterilecek not (çevrilir)
  compact?: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useT(lang, CHROME);
  const dir = langDir(lang);
  const locale = LANG_BCP47[lang] ?? "tr-TR";
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/consultation-requests/${requestId}/messages`);
      if (!r.ok) return;
      const d = await r.json();
      setMsgs(d.messages ?? []);
    } catch {}
  }, [requestId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, [load]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs.length]);

  async function send() {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    setErr("");
    try {
      const r = await fetch(`/api/consultation-requests/${requestId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: v }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Gönderilemedi."); return; }
      setText("");
      if (Array.isArray(d.messages)) setMsgs(d.messages);
    } catch {
      setErr("Bağlantı hatası.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div dir={dir} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <MessagesSquare size={13} /> {t("Yazılı görüşme")}
      </div>
      <div ref={boxRef} className={`space-y-2 overflow-y-auto ${compact ? "max-h-56" : "max-h-72"}`}>
        {msgs.length === 0 && <p className="py-4 text-center text-xs text-slate-400">{t("Henüz mesaj yok.")}</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${m.mine ? "bg-[#14C3D0] text-[#06343a]" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              <p className={`mt-0.5 text-[10px] ${m.mine ? "text-[#06343a]/60" : "text-slate-400"}`}>
                {new Date(m.createdAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {canSend ? (
        <div className="mt-2 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder={t("Mesaj yazın…")}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="min-h-[40px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#14C3D0]"
          />
          <button onClick={send} disabled={sending || !text.trim()} title={t("Mesaj yazın…")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#14C3D0] text-[#06343a] transition hover:bg-[#0EA5B2] disabled:opacity-40">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-400">{t(hintKey || "Uzman hekim bekleniyor — görüşme başlayınca yazabilirsiniz.")}</p>
      )}
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}
