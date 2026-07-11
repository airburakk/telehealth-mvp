"use client";

import { useState } from "react";
import { Bell, MessageCircle, MessageSquareText, Loader2, Check, Save } from "lucide-react";

// Doktor Ana Sayfa — bildirim kanalı tercihi (FAZ 5, 2026-07-10).
// Tüm doktor bildirimleri için kanal: Uygulama (varsayılan) · WhatsApp · SMS.
// Uygulama içi bildirim + push HER ZAMAN yazılır; WhatsApp/SMS buna EK'tir ve şimdilik
// SİMÜLASYONDUR (sağlayıcı hesabı bağlanınca gerçek gönderim başlar — lib/messaging dormant).
const CHANNELS = [
  { key: "APP", label: "Uygulama bildirimi", icon: Bell, desc: "Zil + tarayıcı push (varsayılan)" },
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle, desc: "Cep numaranıza WhatsApp mesajı" },
  { key: "SMS", label: "SMS", icon: MessageSquareText, desc: "Cep numaranıza kısa mesaj" },
] as const;

export function NotifyChannelCard({ initialChannel, initialPhone }: { initialChannel: string; initialPhone: string | null }) {
  const [channel, setChannel] = useState(initialChannel || "APP");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const needsPhone = channel !== "APP";
  const dirty = channel !== (initialChannel || "APP") || (needsPhone && phone.trim() !== (initialPhone ?? ""));

  async function save() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const r = await fetch("/api/doctor/notify-channel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, phone: phone.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata oluştu."); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Bell size={15} /> Bildirim Tercihi
        </div>
        {channel !== "APP" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            WhatsApp/SMS şimdilik simülasyon
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Vaka, talep ve rapor bildirimlerinizi hangi kanaldan almak istersiniz? Uygulama içi bildirim her durumda düşer.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const active = channel === c.key;
          return (
            <button
              key={c.key}
              onClick={() => { setChannel(c.key); setSaved(false); }}
              className={`rounded-2xl border p-3 text-left transition ${active ? "border-[#28C8D8] bg-[#28C8D8]/[0.07]" : "border-slate-200 hover:border-slate-300"}`}
            >
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${active ? "text-[#17919E]" : "text-slate-700"}`}>
                <Icon size={15} /> {c.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-400">{c.desc}</span>
            </button>
          );
        })}
      </div>

      {needsPhone && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Cep telefonu:</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
            placeholder="+90 5xx xxx xx xx"
            className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#28C8D8]"
          />
          {!phone.trim() && <span className="text-[11px] text-amber-600">Bu kanal için telefon numarası gerekli.</span>}
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button
        onClick={save}
        disabled={saving || !dirty || (needsPhone && !phone.trim())}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-3.5 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-40"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
        {saved ? "Kaydedildi" : "Tercihi kaydet"}
      </button>
    </div>
  );
}
