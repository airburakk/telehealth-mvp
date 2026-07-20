"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  computePackage, computeInsurance, INSURANCE_CONFIG, formatUSD, TIER_PRESETS, TRY_PER_USD,
  HEALTH_CHRONIC_OPTIONS, computeHealthRiskMult,
  type Tier, type HospitalType, type PackageSelection, type RecommendedTreatment, type InsuranceLevel, type HealthDeclaration,
} from "@/lib/pricing";
import { countryFlag, countryName } from "@/lib/constants";
import {
  Plane, BedDouble, Building2, Languages, ShieldCheck, Minus, Plus,
  Lock, Loader2, MessageCircle, Check, Send, FileText, ShieldPlus, Stethoscope, Info, HeartPulse,
} from "lucide-react";

const TIERS: Tier[] = ["Ekonomik", "Standart", "Premium"];
const INS_LEVELS: InsuranceLevel[] = [1, 2, 3];
const INS_LEVEL_INFO: Record<InsuranceLevel, { title: string; desc: string }> = {
  1: { title: "Zorunlu Sağlık Turizmi Sigortası", desc: "Türk sağlık hukuku gereği · her pakette dahil" },
  2: { title: "Operasyon Teminat Poliçesi", desc: "Komplikasyon halinde paket bedelini güvenceye alır" },
  3: { title: "Malpraktis & Komplikasyon Teminatı", desc: "Doktor hatası/komplikasyon rizikolarını da kapsar" },
};

export interface PackageInitial {
  tier?: Tier;
  hotelStars?: 4 | 5;
  hospitalType?: HospitalType;
  nights?: number;
  translator?: boolean;
  insuranceLevel?: InsuranceLevel;
  insuranceExtended?: boolean;
  insuranceMalpractice?: boolean;
  aiRationale?: string; // doluysa ön-dolum banner'ı gösterilir
  rationaleTitle?: string; // banner başlığı; verilmezse AI-teklifi varsayılanı (turizm ön-dolumunda hasta-tercihi başlığı geçilir)
}

export function PackageBuilder({
  caseId, patientName, branch, country, initial, treatments, rate = TRY_PER_USD, fxSource, fxAt, doctorMmssLimitUsd, doctorName, offerOnly = false,
  viewer = "staff", healthRiskMult: healthRiskMultInitial = 1, healthDecl = null, healthDeclaredAt = null,
}: { caseId: string; patientName: string; branch: string; country: string; initial?: PackageInitial; treatments?: RecommendedTreatment[]; rate?: number; fxSource?: string; fxAt?: number; doctorMmssLimitUsd?: number; doctorName?: string; offerOnly?: boolean;
  // Sağlık beyanı (sigorta risk formu, 2026-07-20): viewer="patient" beyan formunu açar; personel yalnız
  // çarpan+durum rozeti görür. healthDecl HAM beyan — yalnız hasta görünümüne geçilir (sayfa tarafı filtreler).
  viewer?: "patient" | "staff"; healthRiskMult?: number; healthDecl?: HealthDeclaration | null; healthDeclaredAt?: string | null;
}) {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>(initial?.tier ?? "Standart");
  const [hotelStars, setHotelStars] = useState<4 | 5>(initial?.hotelStars ?? 4);
  const [hospitalType, setHospitalType] = useState<HospitalType>(initial?.hospitalType ?? "Özel");
  const [nights, setNights] = useState(initial?.nights ?? 5);
  const [translator, setTranslator] = useState(initial?.translator ?? false);
  // Sigorta seviyesi (1/2/3). initial booleanlarından da türetilir (AI teklifi geriye uyum).
  const [insLevel, setInsLevel] = useState<InsuranceLevel>(
    initial?.insuranceLevel ?? (initial?.insuranceMalpractice ? 3 : initial?.insuranceExtended === false ? 1 : 2),
  );
  const [submitting, setSubmitting] = useState<null | "offer" | "confirm">(null);
  const [sentOffer, setSentOffer] = useState<string | null>(null);

  // Sağlık beyanı durumu — kaydedilince healthMult güncellenir, prim CANLI yeniden hesaplanır.
  const [healthMult, setHealthMult] = useState(healthRiskMultInitial);
  const [declaredAt, setDeclaredAt] = useState<string | null>(healthDeclaredAt);
  const [declChronic, setDeclChronic] = useState<string[]>(healthDecl?.chronic ?? []);
  const [declMeds, setDeclMeds] = useState(!!healthDecl?.meds);
  const [declSmoking, setDeclSmoking] = useState(!!healthDecl?.smoking);
  const [declSurgery, setDeclSurgery] = useState(!!healthDecl?.majorSurgery);
  const [declConfirm, setDeclConfirm] = useState(false);
  const [declSaving, setDeclSaving] = useState(false);
  const [declEditing, setDeclEditing] = useState(false);
  const [declError, setDeclError] = useState<string | null>(null);

  async function saveDeclaration() {
    setDeclSaving(true); setDeclError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/health-declaration`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chronic: declChronic, meds: declMeds, smoking: declSmoking, majorSurgery: declSurgery }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setHealthMult(Number(data.healthMult) || computeHealthRiskMult({ chronic: declChronic, meds: declMeds, smoking: declSmoking, majorSurgery: declSurgery }));
        setDeclaredAt(data.declaredAt ?? new Date().toISOString());
        setDeclEditing(false); setDeclConfirm(false);
      } else {
        setDeclError(typeof data.error === "string" ? data.error : "Beyan kaydedilemedi. Lütfen tekrar deneyin.");
      }
    } catch { setDeclError("Beyan kaydedilemedi. Lütfen tekrar deneyin."); }
    setDeclSaving(false);
  }

  function applyTier(t: Tier) {
    setTier(t);
    const p = TIER_PRESETS[t];
    if (p.hotelStars) setHotelStars(p.hotelStars);
    if (p.hospitalType) setHospitalType(p.hospitalType);
    setTranslator(!!p.translator);
    if (p.insuranceLevel) setInsLevel(p.insuranceLevel);
  }

  // insuranceLevel ana sürücü; eski booleanlar geriye uyum için türetilir.
  const selection: PackageSelection = { branch, country, tier, hotelStars, hospitalType, nights, translator, insuranceLevel: insLevel, insuranceExtended: insLevel >= 2, insuranceMalpractice: insLevel >= 3 };
  const hasTx = !!treatments && treatments.length > 0;
  const quote = useMemo(() => computePackage(selection, treatments, rate, doctorMmssLimitUsd, healthMult), [tier, hotelStars, hospitalType, nights, translator, insLevel, treatments, rate, doctorMmssLimitUsd, healthMult]);

  // Her sigorta seviyesinin primini canlı göster (kümülatif kartlar). Teminat tabanı/operasyon seçili seviyeden bağımsız.
  const treatmentTotal = quote.insurance.targetCoverage / INSURANCE_CONFIG.targetMultiple;
  const insByLevel = useMemo(
    () => INS_LEVELS.map((lvl) => computeInsurance({ level: lvl, coverageBaseUsd: quote.insurance.coverageBase, treatmentTotalUsd: treatmentTotal, branch, doctorMmssLimitUsd, healthRiskMult: healthMult })),
    [quote.insurance.coverageBase, treatmentTotal, branch, doctorMmssLimitUsd, healthMult],
  );

  async function confirm() {
    setSubmitting("confirm");
    try {
      const res = await fetch(`/api/cases/${caseId}/booking`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, hotelStars, hospitalType, nights, translator, insuranceLevel: insLevel }),
      });
      const data = await res.json();
      if (data.bookingId) router.push(`/rezervasyon/${data.bookingId}`);
      else setSubmitting(null);
    } catch { setSubmitting(null); }
  }

  // Hastaya teklif gönder — DRAFT booking oluşturur, hastaya bildirim düşer; onay hastada.
  async function sendOffer() {
    setSubmitting("offer");
    try {
      const res = await fetch(`/api/cases/${caseId}/booking`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, hotelStars, hospitalType, nights, translator, insuranceLevel: insLevel, mode: "offer" }),
      });
      const data = await res.json();
      if (data.bookingId) setSentOffer(data.bookingId);
      else setSubmitting(null);
    } catch { setSubmitting(null); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Seçimler */}
      <div className="space-y-4">
        {initial?.aiRationale && (
          <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3.5">
            <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-violet-300">{initial?.rationaleTitle ?? "✨ Sağlık Turizmi Agent'ı teklifi uygulandı"}</div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--c-ink-2)]">{initial.aiRationale}</p>
            <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">Tüm değerleri aşağıdan değiştirebilirsiniz; fiyat platform motorunda hesaplanır.</p>
          </div>
        )}
        {hasTx && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3.5">
            <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300">🩺 Doktorun tavsiye ettiği tedaviler uygulandı</div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--c-ink-2)]">
              Tedavi kalemleri ve fiyatları, görüşmeyi yapan doktorun seçtiği işlemlerden (₺) gelir; pakette güncel kurla $ olarak gösterilir.
            </p>
            <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">{treatments!.length} tedavi · özet kartında kalem kalem listelenir.</p>
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
                className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                  tier === t ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-[var(--c-ink-2)] hover:border-[var(--c-hairline)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--c-ink-3)]">Seviye seçimi otel, sigorta ve tercüman varsayılanlarını ayarlar; aşağıdan tek tek değiştirebilirsiniz.</p>
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
            <span className="text-sm font-medium text-[var(--c-ink)]">Konaklama süresi</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setNights((n) => Math.max(1, n - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"><Minus size={15} /></button>
              <span className="w-14 text-center text-sm font-semibold">{nights} gece</span>
              <button onClick={() => setNights((n) => Math.min(30, n + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"><Plus size={15} /></button>
            </div>
          </div>
        </Card>

        {/* Hizmetler */}
        <Card>
          <CardTitle icon={<Plane size={15} />}>Ek Hizmetler</CardTitle>
          <Toggle icon={<Languages size={16} />} label="Tıbbi tercüman (refakatçi)" desc="Branşa hakim, hastanın dilinde" on={translator} set={setTranslator} />
        </Card>

        {/* Sağlık Beyanı (sigorta risk formu, 2026-07-20) — yalnız hasta doldurur; prim canlı güncellenir */}
        {viewer === "patient" && (
          <Card>
            <CardTitle icon={<HeartPulse size={15} />}>Sağlık Beyanı</CardTitle>
            <p className="mt-1 text-xs text-[var(--c-ink-3)]">Sigorta primi, sağlık beyanınıza göre kişiselleştirilir. Beyanınız şifreli saklanır; yalnız vakanıza erişimi olan klinik ekip görebilir.</p>
            {declaredAt && !declEditing ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-3">
                <span className="text-sm font-medium text-emerald-300">✓ Beyan alındı · {new Date(declaredAt).toLocaleDateString("tr-TR")}</span>
                <button type="button" onClick={() => setDeclEditing(true)} className="shrink-0 text-xs font-semibold text-[var(--c-accent)] hover:underline">Güncelle</button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-sm font-medium text-[var(--c-ink)]">Bilinen kronik hastalık(lar)</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <DeclChip label="Yok" active={declChronic.length === 0} onClick={() => setDeclChronic([])} />
                    {HEALTH_CHRONIC_OPTIONS.map((o) => (
                      <DeclChip key={o} label={o} active={declChronic.includes(o)}
                        onClick={() => setDeclChronic((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o])} />
                    ))}
                  </div>
                </div>
                <DeclYesNo label="Düzenli ilaç kullanıyor musunuz?" on={declMeds} set={setDeclMeds} />
                <DeclYesNo label="Sigara kullanıyor musunuz?" on={declSmoking} set={setDeclSmoking} />
                <DeclYesNo label="Son 5 yılda büyük ameliyat geçirdiniz mi?" on={declSurgery} set={setDeclSurgery} />
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--c-ink-2)]">
                  <input type="checkbox" checked={declConfirm} onChange={(e) => setDeclConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]" />
                  Verdiğim bilgilerin doğru ve eksiksiz olduğunu beyan ederim.
                </label>
                {declError && <p className="text-xs text-red-400">{declError}</p>}
                <button
                  type="button"
                  onClick={saveDeclaration}
                  disabled={!declConfirm || declSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] disabled:opacity-50"
                >
                  {declSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Beyanı Kaydet
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Sigorta — 3 kademeli kümülatif teminat */}
        <Card>
          <CardTitle icon={<ShieldCheck size={15} />}>Sigorta Teminatı</CardTitle>
          <p className="mt-1 text-xs text-[var(--c-ink-3)]">Operasyonun mali büyüklüğü ve doktorun mevcut mesleki sigortası dikkate alınarak hesaplanır.</p>
          {viewer !== "patient" && (
            <p className="mt-1.5 text-[11px] font-medium text-[var(--c-ink-2)]">
              {declaredAt
                ? <>Sağlık beyanı alındı · risk çarpanı ×{healthMult.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                : <>Sağlık beyanı bekleniyor</>}
            </p>
          )}
          {viewer === "patient" && !declaredAt && (
            <p className="mt-1.5 text-[11px] text-amber-300">Sağlık beyanı doldurulmadı — primler taban çarpanla gösteriliyor.</p>
          )}
          <div className="mt-3 space-y-2">
            {INS_LEVELS.map((lvl) => {
              const q = insByLevel[lvl - 1];
              const info = INS_LEVEL_INFO[lvl];
              const active = insLevel === lvl;
              const Icon = lvl === 1 ? ShieldCheck : lvl === 2 ? ShieldPlus : Stethoscope;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setInsLevel(lvl)}
                  aria-pressed={active}
                  className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--c-ink)]">Seviye {lvl} · {info.title}</span>
                        <span className="shrink-0 text-sm font-bold text-[var(--c-ink)]">{formatUSD(q.total)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">{info.desc}</p>
                      {lvl >= 2 && (
                        <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">Teminat tabanı {formatUSD(q.coverageBase)} · operasyon teminat primi +{formatUSD(q.p2)}</p>
                      )}
                      {lvl === 3 && (
                        <div className="mt-1 rounded-lg bg-[var(--c-surface)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--c-ink-2)]">
                          Hedef malpraktis teminatı {formatUSD(q.targetCoverage)} (operasyon ×{INSURANCE_CONFIG.targetMultiple}).{" "}
                          {doctorMmssLimitUsd != null ? (
                            q.gap === 0 ? (
                              <span className="mt-0.5 block font-medium text-emerald-300">✓ {doctorName ? `${doctorName} ` : "Doktor "}mevcut MMSS poliçesi ({formatUSD(q.doctorCoverage)}) hedefi karşılıyor → ek malpraktis primi yok</span>
                            ) : (
                              <span className="mt-0.5 block">Doktor MMSS poliçesi {formatUSD(q.doctorCoverage)} karşılıyor; {formatUSD(q.gap)} boşluk için ek malpraktis primi <strong className="text-[var(--c-ink)]">+{formatUSD(q.p3)}</strong></span>
                            )
                          ) : (
                            <span className="mt-0.5 block text-amber-300">Doktor MMSS bilgisi yok — boşluk tam kabul edildi (+{formatUSD(q.p3)})</span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-transparent"}`}>
                      <Check size={12} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
            <Info size={13} className="mt-0.5 shrink-0" /> Gösterilen primler endikatiftir; kesin prim ve teminat şartları sigorta şirketinin değerlendirmesiyle belirlenir. Prim, sağlık beyanına göre değişebilir.
          </p>
        </Card>
      </div>

      {/* Özet (Escrow) */}
      <aside className="lg:sticky lg:top-20 self-start">
        <Card>
          <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Paket Özeti · {patientName}</div>
          <div className="mt-1 text-sm text-[var(--c-ink-2)]">{countryFlag(country)} {countryName(country)} · {branch}</div>

          <ul className="mt-4 space-y-2">
            {quote.items.map((it) => (
              <li key={it.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-[var(--c-ink-2)]">
                  {it.label}
                  {it.note && <span className="block text-xs text-[var(--c-ink-3)]">{it.note}</span>}
                </span>
                <span className="shrink-0 font-medium text-[var(--c-ink)]">{formatUSD(it.amount)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-[var(--c-hairline)] pt-3 text-sm">
            <Row k="Ara toplam" v={formatUSD(quote.subtotal)} />
            <Row k="Platform komisyonu" v={formatUSD(quote.platformFee)} muted />
          </div>
          <div className="mt-2 flex items-end justify-between border-t border-[var(--c-hairline)] pt-3">
            <span className="text-sm font-semibold text-[var(--c-ink)]">Toplam</span>
            <span className="text-2xl font-bold text-[var(--c-ink)]">{formatUSD(quote.total)}</span>
          </div>
          {hasTx && (
            <div className="mt-2 text-[11px] text-[var(--c-ink-3)]">
              1 USD ≈ {rate.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺
              {fxSource ? ` · ${fxSource}` : ""}{fxAt ? ` · ${new Date(fxAt).toLocaleDateString("tr-TR")}` : ""}
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--c-accent)]/10 px-3 py-2 text-xs text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/20">
            <Lock size={14} className="mt-0.5 shrink-0" />
            Ödeme platform Escrow havuzunda emanet tutulur; hizmet tamamlanınca taraflara aktarılır.
          </div>

          {sentOffer ? (
            <div className="mt-4 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3.5 text-center">
              <div className="text-sm font-semibold text-violet-200">✓ Teklif {patientName}&apos;e gönderildi</div>
              <p className="mt-0.5 text-xs text-violet-200/90">Hastanın bildirimine düştü. Onayladığında Escrow&apos;a alınır.</p>
              <Link href={`/teklif/${sentOffer}`} className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                <FileText size={15} /> Teklif sayfasını aç
              </Link>
            </div>
          ) : (
            <>
              <button
                onClick={sendOffer}
                disabled={!!submitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {submitting === "offer" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Hastaya teklif gönder
              </button>
              {/* Acente modu (offerOnly, FAZ 4): doğrudan Escrow YOK — onay daima hastada */}
              {!offerOnly && (
                <>
                  <button
                    onClick={confirm}
                    disabled={!!submitting}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60"
                  >
                    {submitting === "confirm" ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Doğrudan Escrow ile onayla
                  </button>
                  <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--c-hairline)] px-4 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
                    <MessageCircle size={15} /> Koordinatörle konuş
                  </button>
                </>
              )}
            </>
          )}
        </Card>
      </aside>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">{children}</div>;
}
// Sağlık beyanı yardımcıları (sigorta risk formu, 2026-07-20)
function DeclChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40"}`}
    >
      {label}
    </button>
  );
}
function DeclYesNo({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-[var(--c-ink)]">{label}</span>
      <Segment value={on ? "Evet" : "Hayır"} onChange={(v) => set(v === "Evet")} options={["Hayır", "Evet"]} />
    </div>
  );
}
function CardTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">{icon} {children}</div>;
}
function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-[var(--c-ink-3)]" : "text-[var(--c-ink-2)]"}>{k}</span>
      <span className={muted ? "text-[var(--c-ink-2)]" : "text-[var(--c-ink)]"}>{v}</span>
    </div>
  );
}
function Segment({ value, onChange, options, render }: { value: string; onChange: (v: string) => void; options: string[]; render?: (o: string) => string }) {
  return (
    <div className="mt-2 inline-flex rounded-lg border border-[var(--c-hairline)] p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${value === o ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)] hover:bg-[var(--c-ink)]/10"}`}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}
function Toggle({ icon, label, desc, on, set }: { icon?: React.ReactNode; label: string; desc?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="mt-2 flex w-full items-center justify-between rounded-lg border border-[var(--c-hairline)] px-3 py-2.5 text-left hover:border-[var(--c-hairline)]">
      <span className="flex items-center gap-2">
        {icon && <span className="text-[var(--c-ink-2)]">{icon}</span>}
        <span>
          <span className="block text-sm font-medium text-[var(--c-ink)]">{label}</span>
          {desc && <span className="block text-xs text-[var(--c-ink-3)]">{desc}</span>}
        </span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-[var(--c-ink)]/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--c-panel)] shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
