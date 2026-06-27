"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, COUNTRIES } from "@/lib/constants";
import { Globe, MapPin, CalendarClock, Save, Loader2, Check, BadgeCheck, HeartHandshake, Inbox } from "lucide-react";

// Hekimin kendi profil tercihleri — hizmet dilleri + hizmet verdiği pazarlar (ülkeler) + aylık kapasite limiti
// + birim katılımı (Pro Bono / Konsültasyon opt-in — Ana Sayfa pencere görünürlüğü).
// /api/doctor/preferences'a kaydeder (yalnız oturumdaki hekimin kaydı).
export function DoctorPreferences({ languages, markets, capacity, licenseNo, proBonoOptIn, consultOptIn }: { languages: string[]; markets: string[]; capacity: number; licenseNo: string | null; proBonoOptIn: boolean; consultOptIn: boolean }) {
  const router = useRouter();
  const [langs, setLangs] = useState<string[]>(languages);
  const [mkts, setMkts] = useState<string[]>(markets);
  const [cap, setCap] = useState<number>(capacity);
  const [lic, setLic] = useState<string>(licenseNo ?? "");
  const [pb, setPb] = useState<boolean>(proBonoOptIn);
  const [cs, setCs] = useState<boolean>(consultOptIn);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  function toggle(arr: string[], setArr: (v: string[]) => void, v: string) {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      const r = await fetch("/api/doctor/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: langs, markets: mkts, capacity: cap, licenseNo: lic, proBonoOptIn: pb, consultOptIn: cs }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Globe size={15} /> Profil Tercihleri
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Globe size={14} className="text-slate-400" /> Hizmet dilleri</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LANGUAGES.map((l) => <Chip key={l} active={langs.includes(l)} onClick={() => toggle(langs, setLangs, l)}>{l}</Chip>)}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700">
          <MapPin size={14} className="text-slate-400" /> Hizmet verdiğim ülkeler / pazarlar
          <span className="text-xs font-normal text-slate-400">(boş = tüm pazarlar)</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COUNTRIES.map((c) => <Chip key={c.code} active={mkts.includes(c.code)} onClick={() => toggle(mkts, setMkts, c.code)}>{c.flag} {c.name}</Chip>)}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><CalendarClock size={14} className="text-slate-400" /> Aylık kapasite limiti</div>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number" min={1} max={200} value={cap}
            onChange={(e) => { setCap(Number(e.target.value)); setSaved(false); }}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]"
          />
          <span className="text-xs text-slate-500">işlem / ay</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700">
          <BadgeCheck size={14} className="text-slate-400" /> Diploma / Tescil No
          <span className="text-xs font-normal text-slate-400">(FHIR Practitioner.identifier)</span>
        </div>
        <input
          type="text" value={lic} placeholder="ör. TR-123456"
          onChange={(e) => { setLic(e.target.value); setSaved(false); }}
          className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]"
        />
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="text-sm font-medium text-slate-700">Birim katılımı</div>
        <p className="text-xs text-slate-400">Ana Sayfanızdaki pencerelerin görünürlüğünü belirler.</p>
        <div className="mt-3 space-y-2">
          <OptToggle
            active={pb}
            onToggle={() => { setPb((v) => !v); setSaved(false); }}
            icon={<HeartHandshake size={16} />}
            title="Pro Bono — ücretsiz konsültasyon"
            desc="Ana Sayfada Pro Bono penceresi görünür; gönüllü ücretsiz görüşme alırsınız."
          />
          <OptToggle
            active={cs}
            onToggle={() => { setCs((v) => !v); setSaved(false); }}
            icon={<Inbox size={16} />}
            title="Konsültasyon Talepleri — Partner doktorlar"
            desc="Anonim hasta dosyalarına görüş verirsiniz; yanıt başına ödeme (simüle)."
          />
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? "Kaydedildi" : "Tercihleri kaydet"}
      </button>
    </div>
  );
}

function OptToggle({ active, onToggle, icon, title, desc }: { active: boolean; onToggle: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-[#14C3D0] bg-[#14C3D0]/[0.06]" : "border-slate-200 bg-white hover:border-[#14C3D0]/40"}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${active ? "bg-[#14C3D0] text-[#101010]" : "bg-slate-100 text-slate-500"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-700">{title}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? "border-[#14C3D0] bg-[#14C3D0] text-[#101010]" : "border-slate-300 bg-white text-transparent"}`}>
        <Check size={12} />
      </span>
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-[#14C3D0] bg-[#14C3D0] text-[#101010]" : "border-slate-300 bg-white text-slate-600 hover:border-[#14C3D0]/40 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}
