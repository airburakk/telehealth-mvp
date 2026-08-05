"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/constants";
import { MailQuestion, Scale, ChevronDown, Clock3, CheckCircle2, Loader2, Send, Inbox } from "lucide-react";

// Sistem Mesajları listesi (v6.79) — Aura kiti üzerinde, gece-varsayılan temayla.
// Satır: tip ikonu + konu + tarih + durum rozeti; açılınca gövde + (hedef bensem) TEK yanıt formu.
// Sayfa açılışında okunmamışlar okundu işaretlenir (NotificationBell panel-açılış deseni).
// TR-sabit: bugün mesaj alan roller personel (koordinatör/acente/doktor); hasta mesaj almaya
// başlayınca useT çeviri turu ayrıca yapılır (plan notu).

interface Msg {
  id: string;
  kind: string;
  subject: string;
  body: string;
  needsReply: boolean;
  reply: string | null;
  repliedAt: string | null;
  readAt: string | null;
  createdAt: string;
  canReply: boolean;
}

const KIND_META: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  DEFENSE_REQUEST: { icon: <Scale size={15} />, cls: "bg-amber-500/15 text-amber-300", label: "Savunma/bilgi talebi" },
};
const DEFAULT_META = { icon: <MailQuestion size={15} />, cls: "bg-[var(--c-accent)]/15 text-[var(--c-accent)]", label: "Sistem mesajı" };

export function MessagesList() {
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const r = await fetch("/api/system-messages");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await refresh();
      // Açılışta okundu işaretle — rozetler (menü satırı + avatar toplamı) bir sonraki tickte söner.
      try { await fetch("/api/system-messages", { method: "POST" }); } catch {}
    })();
  }, []);

  async function sendReply(id: string) {
    setError("");
    if (replyText.trim().length < 10) { setError("Yanıt metni en az 10 karakter olmalıdır."); return; }
    setSending(true);
    try {
      const r = await fetch(`/api/system-messages/${id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Hata");
      setReplyText("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yanıt gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <PageHeader
        eyebrow="İletişim"
        title="Sistem Mesajları"
        sub="Platform süreçlerine bağlı mesajlar — size düşen talepler ve yanıtlarınız. Bildirimlerden farklı olarak bu mesajlar içerik taşır ve yanıt bekleyebilir."
      />

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-[var(--c-ink-3)]"><Loader2 size={16} className="animate-spin" /> Yükleniyor…</div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState className="mt-8" title={<span className="inline-flex items-center gap-2"><Inbox size={18} /> Sistem mesajınız yok</span>} sub="Size düşen bir talep ya da duyuru olduğunda burada görünür; ayrıca cihaz bildirimi alırsınız." />
      )}

      <div className="mt-6 space-y-3">
        {items.map((m) => {
          const meta = KIND_META[m.kind] ?? DEFAULT_META;
          const open = openId === m.id;
          const awaiting = m.needsReply && !m.repliedAt;
          return (
            <div key={m.id} className={`overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] shadow-sm ${!m.readAt ? "ring-1 ring-[var(--c-accent)]/30" : ""}`}>
              <button
                onClick={() => { setOpenId(open ? null : m.id); setError(""); setReplyText(""); }}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-[var(--c-surface)]"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.cls}`}>{meta.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--c-ink)]">{m.subject}</span>
                  <span className="block text-xs text-[var(--c-ink-3)]">{meta.label} · {formatDateTime(new Date(m.createdAt))}</span>
                </span>
                {awaiting ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/25"><Clock3 size={11} /> Yanıt bekleniyor</span>
                ) : m.repliedAt ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25"><CheckCircle2 size={11} /> Yanıtlandı</span>
                ) : null}
                <ChevronDown size={16} className={`shrink-0 text-[var(--c-ink-3)] transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="border-t border-[var(--c-hairline)] px-4 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--c-ink-2)]">{m.body}</p>

                  {m.reply && (
                    <div className="mt-3 rounded-lg bg-[var(--c-surface)] p-3 ring-1 ring-white/10">
                      <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Verilen yanıt{m.repliedAt ? ` · ${formatDateTime(new Date(m.repliedAt))}` : ""}</div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--c-ink)]">{m.reply}</p>
                    </div>
                  )}

                  {m.canReply && (
                    <div className="mt-4">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={4}
                        placeholder="Yanıtınız… (kurula kimliğiniz gösterilmeden iletilir)"
                        className="w-full resize-none rounded-lg border border-[var(--c-hairline)] p-2.5 text-sm outline-none focus:border-[var(--c-accent)]"
                      />
                      {error && <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}
                      <button
                        onClick={() => sendReply(m.id)}
                        disabled={sending}
                        className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
                      >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Yanıtı gönder
                      </button>
                      <p className="mt-1.5 text-[11px] text-[var(--c-ink-3)]">Tek yanıt hakkı vardır; gönderdikten sonra değiştirilemez.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
