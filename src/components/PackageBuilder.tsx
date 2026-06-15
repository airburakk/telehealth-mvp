"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computePackage, formatUSD, TIER_PRESETS,
  type Tier, type HospitalType, type PackageSelection, type RecommendedTreatment,
} from "@/lib/pricing";
import { countryFlag, countryName } from "@/lib/constants";
import {
  Plane, BedDouble, Building2, Languages, ShieldCheck, Minus, Plus,
  Lock, Loader2, MessageCircle, Check,
} from "lucide-react";

const TIERS: Tier[] = ["Ekonomik", "Standart", "Premium"];

export interface PackageInitial {
  tier?: Tier;
  hotelStars?: 4 | 5;
  hospitalType?: HospitalType;
  nights?: number;
  translator?: boolean;
  insuranceExtended?: boolean;
  insuranceMalpractice?: boolean;
  aiRationale?: string; // doluysa "AI teklifi" banner'ı gösterilir
}

export function PackageBuilder({
  caseId, patientName, branch, country, initial, treatments,
}: { caseId: string; patientName: string; branch: string; country: string; initial?: PackageInitial; treatments?: RecommendedTreatment[] }) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>(initial?.tier ?? "Standart");
  const [hotelStars, setHotelStars] = useState<4 | 5>(initial?.hotelStars ?? 4);
  const [hospitalType, setHospitalType] = useState<HospitalType>(initial?.hospitalType ?? "Özel");
  const [nights, setNights] = useState(initial?.nights ?? 5);
  const [translator, setTranslator] = useState(initial?.translator ?? false);
  const [insExtended, setInsExtended] = useState(initial?.insuranceExtended ?? true);
  const [insMalpractice, setInsMalpractice] = useState(initial?.insuranceMalpractice ?? false);
  const [submitting, setSubmitting] = useState(false);

  function applyTier(t: Tier) {
    setTier(t);
    const p = TIER_PRESETS[t];
    if (p.hotelStars) setHotelStars(p.hotelStars);
    if (p.hospitalType) setHospitalType(p.hospitalType);
    setTranslator(!!p.translator);
    setInsExtended(!!p.insuranceExtended);
    setInsMalpractice(!!p.insuranceMalpractice);
  }

  const selection: PackageSelection = { branch, country, tier, hotelStars, hospitalType, nights, translator, insuranceExtended: insExtended, insuranceMalpractice: insMalpractice };
  const hasTx = !!treatments && treatments.length > 0;
  const quote = useMemo(() => computePackage(selection, treatments), [tier, hotelStars, hospitalType, nights, translator, insExtended, insMalpractice, treatments]);

  async function confirm() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/booking`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, hotelStars, hospitalType, nights, translator, insuranceExtended: insExtended, insuranceMalpractice: insMalpractice }),
      });
      const data = await res.json();
      if (data.bookingId) router.push(`/rezervasyon/${data.bookingId}`);
      else setSubmitting(false);
    } catch { setSubmitting(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Seçimler */}
      <div className="space-y-4">
        {initial?.aiRationale && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">✨ Sağlık Turizmi Agent&apos;ı teklifi uygulandı</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{initial.aiRationale}</p>
            <p className="mt-1 text-[11px] text-slate-400">Tüm değerleri aşağıdan değiştirebilirsiniz; fiyat platform motorunda hesaplanır.</p>
          </div>
        )}
        {hasTx && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">🩺 Doktorun tavsiye ettiği tedaviler uygulandı</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Tedavi kalemleri ve fiyatları, görüşmeyi yapan doktorun seçtiği işlemlerden (₺) gelir; pakette güncel kurla $ olarak gösterilir.
            </p>
            <p className="mt-1 text-[11px] text-slate-400">{treatments!.length} tedavi · özet kartında kalem kalem listelenir.</p>
          </div>
        )}
        {/* Tier */}
        <Card>
          <CardTitle>Paket Seviyesi</CardTitle>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => applyTier(t)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  tier === t ? "border-[#0E9E97] bg-[#0E9E97] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Seviye seçimi otel, sigorta ve tercüman varsayılanlarını ayarlar; aşağıdan tek tek değiştirebilirsiniz.</p>
        </Card>

        {/* Hastane + Otel */}
        <Card>
          <CardTitle icon={<Building2 size={15} />}>Hastane</CardTitle>
          <Segment value={hospitalType} onChange={(v) => setHospitalType(v as HospitalType)} options={["Özel", "Üniversite"]} />

          <div className="mt-4">
            <CardTitle icon={<BedDouble size={15} />}>Otel</CardTitle>
            <Segment value={String(hotelStars)} onChange={(v) => setHotelStars(v === "5" ? 5 : 4)} options={["4", "5"]} render={(o) => `${o}★`} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Konaklama süresi</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setNights((n) => Math.max(1, n - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"><Minus size={15} /></button>
              <span className="w-14 text-center text-sm font-semibold">{nights} gece</span>
              <button onClick={() => setNights((n) => Math.min(30, n + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"><Plus size={15} /></button>
            </div>
          </div>
        </Card>

        {/* Hizmetler */}
        <Card>
          <CardTitle icon={<Plane size={15} />}>Ek Hizmetler</CardTitle>
          <Toggle icon={<Languages size={16} />} label="Tıbbi tercüman (refakatçi)" desc="Branşa hakim, hastanın dilinde" on={translator} set={setTranslator} />
        </Card>

        {/* Sigorta */}
        <Card>
          <CardTitle icon={<ShieldCheck size={15} />}>Sigorta</CardTitle>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-700">Zorunlu sağlık sigortası</div>
              <div className="text-xs text-slate-400">Türk sağlık hukuku gereği · her pakette dahil</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check size={13} /> Dahil</span>
          </div>
          <Toggle label="Genişletilmiş poliçe" desc="Tüm süreci kapsayan, yüksek limitli" on={insExtended} set={setInsExtended} />
          <Toggle label="Komplikasyon & malpraktis" desc="Operasyon sonrası risk teminatı" on={insMalpractice} set={setInsMalpractice} />
        </Card>
      </div>

      {/* Özet (Escrow) */}
      <aside className="lg:sticky lg:top-20 self-start">
        <Card>
          <div className="text-xs uppercase tracking-wide text-slate-400">Paket Özeti · {patientName}</div>
          <div className="mt-1 text-sm text-slate-500">{countryFlag(country)} {countryName(country)} · {branch}</div>

          <ul className="mt-4 space-y-2">
            {quote.items.map((it) => (
              <li key={it.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-slate-600">
                  {it.label}
                  {it.note && <span className="block text-xs text-slate-400">{it.note}</span>}
                </span>
                <span className="shrink-0 font-medium text-slate-800">{formatUSD(it.amount)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
            <Row k="Ara toplam" v={formatUSD(quote.subtotal)} />
            <Row k="Platform komisyonu" v={formatUSD(quote.platformFee)} muted />
          </div>
          <div className="mt-2 flex items-end justify-between border-t border-slate-200 pt-3">
            <span className="text-sm font-semibold text-slate-700">Toplam</span>
            <span className="text-2xl font-bold text-[#0A3F39]">{formatUSD(quote.total)}</span>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800 ring-1 ring-teal-100">
            <Lock size={14} className="mt-0.5 shrink-0" />
            Ödeme platform Escrow havuzunda emanet tutulur; hizmet tamamlanınca taraflara aktarılır.
          </div>

          <button
            onClick={confirm}
            disabled={submitting}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Escrow ile onayla
          </button>
          <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <MessageCircle size={15} /> Koordinatörle konuş
          </button>
        </Card>
      </aside>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>;
}
function CardTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon} {children}</div>;
}
function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-400" : "text-slate-500"}>{k}</span>
      <span className={muted ? "text-slate-500" : "text-slate-700"}>{v}</span>
    </div>
  );
}
function Segment({ value, onChange, options, render }: { value: string; onChange: (v: string) => void; options: string[]; render?: (o: string) => string }) {
  return (
    <div className="mt-2 inline-flex rounded-lg border border-slate-200 p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${value === o ? "bg-[#0E9E97] text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}
function Toggle({ icon, label, desc, on, set }: { icon?: React.ReactNode; label: string; desc?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-slate-300">
      <span className="flex items-center gap-2">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span>
          <span className="block text-sm font-medium text-slate-700">{label}</span>
          {desc && <span className="block text-xs text-slate-400">{desc}</span>}
        </span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
