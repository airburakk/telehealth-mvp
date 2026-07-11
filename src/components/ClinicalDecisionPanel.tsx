"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTRY, tryToUsd } from "@/lib/pricing";
import {
  Search, Plus, X, Save, Loader2, Check, ClipboardList, Stethoscope,
  Sparkles, CalendarRange, Building2, Send, Lock, ShieldCheck,
} from "lucide-react";

// ── Birleşik Klinik Kodlama (FHIR) + Tedavi Kararı paneli (2026-07-10 FAZ 2) ──
// Eski FhirCodingForm + RecommendedTreatments tek ekranda, yukarıdan aşağı akışla birleşti:
//   1) Tanı ICD-10 + hasta kimliği  →  2) tanıya EŞLENMİŞ işlemler aktifleşir (statik eşleme
//   data/icd-procedures + istenirse AI önerisi — hibrit)  →  3) işlem başına taban↔tavan slider
//   ücreti  →  4) öngörülen tedavi süresi (gün aralığı)  →  5) hastane seçimi (HealthTürkiye
//   dizini; boşsa serbest metin)  →  6) Kaydet = dosya Sağlık Turizmi Acentesine (STA) iletilir.
// "Paketi oluştur" / "AI Teklif hazırla" / "Sağlık Turizmi Paketi" düğmeleri KALDIRILDI —
// teklifi artık doktor değil, STA hazırlar (kısıtlı dosyayla).

interface Proc { code: string; name: string; price: number | null; branch: string; group: string }
interface Sel { name: string; priceTRY: number; floor: number }
interface Suggestion { code: string; name: string; price: number | null; reason: string }
interface HospitalHit { id: number; name: string; cityName: string | null; cityHasAirport: boolean | null; facilityTypeName: string | null; totalPersonnel: number | null; accreditationCount: number | null; languages?: string[]; accreditations?: string[]; authorizationNumber?: string | null }

const CEIL_MULT = 3;

function hueFor(price: number, floor: number, ceil: number): string {
  const r = ceil > floor ? Math.min(1, Math.max(0, (price - floor) / (ceil - floor))) : 0;
  return `hsl(${Math.round(120 * (1 - r))} 75% 42%)`;
}

export default function ClinicalDecisionPanel({
  caseId, branchLabel, branchProcedures, doctorPrices, initial, rate,
  icd10Code, patientIdentifier, patientIdentifierType, icd10Options, icdProcedures,
  initialDaysMin, initialDaysMax, initialHospitalId, initialHospitalName, agencySentAt,
  getNotes,
}: {
  caseId: string;
  branchLabel: string;
  branchProcedures: Proc[];
  doctorPrices: Record<string, number>;
  initial: { code: string; name: string; priceTRY: number }[];
  rate: number;
  icd10Code: string | null;
  patientIdentifier: string | null;
  patientIdentifierType: string | null;
  icd10Options: { code: string; label: string }[];
  icdProcedures: Record<string, { code: string; name: string; price: number | null }[]>; // ICD → katalog-çözümlü eşlenmiş işlemler (çapraz-branş dahil)
  initialDaysMin: number | null;
  initialDaysMax: number | null;
  initialHospitalId: number | null;
  initialHospitalName: string | null;
  agencySentAt: string | null; // ISO — dosya daha önce STA'ya iletildiyse
  getNotes?: () => string; // AI önerisine bağlam olarak doktorun güncel notu
}) {
  const router = useRouter();

  // ── 1 · Klinik kodlama ──
  const [icd, setIcd] = useState(icd10Code ?? "");
  const [pid, setPid] = useState(patientIdentifier ?? "");
  const [ptype, setPtype] = useState(patientIdentifierType ?? "TC");
  const [codingSaving, setCodingSaving] = useState(false);
  const [codingSaved, setCodingSaved] = useState(false);
  const [codingErr, setCodingErr] = useState("");
  const icdNorm = icd.trim().toUpperCase();
  const selectedIcdLabel = icd10Options.find((o) => o.code === icdNorm)?.label ?? "";
  const mappedIcdCodes = useMemo(() => new Set(Object.keys(icdProcedures ?? {})), [icdProcedures]); // ?? — eski önbellekli server props'a (HMR/stale RSC) karşı savunma

  // ── 2 · İşlem seçimi + ücret ──
  const [sel, setSel] = useState<Record<string, Sel>>(() => {
    const m: Record<string, Sel> = {};
    for (const it of initial) {
      const bp = branchProcedures.find((p) => p.code === it.code);
      m[it.code] = { name: it.name, priceTRY: it.priceTRY, floor: bp?.price && bp.price > 0 ? bp.price : it.priceTRY };
    }
    return m;
  });
  const [query, setQuery] = useState("");
  const [catMode, setCatMode] = useState(false);
  const [catRes, setCatRes] = useState<Proc[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI önerisi (hibrit — statik eşlemenin yanında isteğe bağlı)
  const [aiSugs, setAiSugs] = useState<Suggestion[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");

  // ── 3 · Süre ──
  const [daysMin, setDaysMin] = useState<string>(initialDaysMin != null ? String(initialDaysMin) : "");
  const [daysMax, setDaysMax] = useState<string>(initialDaysMax != null ? String(initialDaysMax) : "");

  // ── 4 · Hastane ──
  const [hospId, setHospId] = useState<number | null>(initialHospitalId);
  const [hospName, setHospName] = useState<string>(initialHospitalName ?? "");
  const [hospQ, setHospQ] = useState("");
  const [hospRes, setHospRes] = useState<HospitalHit[]>([]);
  const [hospLoading, setHospLoading] = useState(false);
  const [hospSearched, setHospSearched] = useState(false);
  const hospDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 5 · Kaydet & STA ──
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(agencySentAt);

  const icdChosen = icdNorm.length >= 2; // elle girilen kod da tanı sayılır (liste dışı tanılar)
  // Katalog-çözümlü eşleme (sunucudan): çapraz-branş kodlar da chip olur (ör. onkolojide kemoterapi).
  const mappedProcs = useMemo(() => (icdProcedures ?? {})[icdNorm] ?? [], [icdProcedures, icdNorm]);

  async function saveCoding() {
    setCodingSaving(true); setCodingErr(""); setCodingSaved(false);
    try {
      const r = await fetch(`/api/cases/${caseId}/coding`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icd10Code: icd, patientIdentifier: pid, patientIdentifierType: ptype }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setCodingSaved(true);
      router.refresh();
    } catch (e) { setCodingErr(e instanceof Error ? e.message : "Hata oluştu."); }
    finally { setCodingSaving(false); }
  }

  function add(p: { code: string; name: string; price: number | null }) {
    const floor = p.price && p.price > 0 ? p.price : 0;
    const price = doctorPrices[p.code] ?? floor;
    setSel((s) => ({ ...s, [p.code]: { name: p.name, priceTRY: price, floor } }));
  }
  function remove(code: string) {
    setSel((s) => { const n = { ...s }; delete n[code]; return n; });
  }
  function setPrice(code: string, v: number) {
    setSel((s) => ({ ...s, [code]: { ...s[code], priceTRY: v } }));
  }

  const branchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return branchProcedures
      .filter((p) => !(p.code in sel) && (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [query, branchProcedures, sel]);

  function catSearch(q: string) {
    setQuery(q);
    if (!catMode) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) { setCatRes([]); return; }
    setCatLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/doctor/procedures?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setCatRes((d.items ?? []) as Proc[]);
      } catch { setCatRes([]); }
      setCatLoading(false);
    }, 280);
  }

  async function askAi() {
    setAiBusy(true); setAiErr(""); setAiSugs(null);
    try {
      const r = await fetch("/api/ai/suggest-procedures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, icd10Code: icdNorm, notes: getNotes ? getNotes() : "" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "AI önerisi alınamadı.");
      setAiSugs((d.suggestions ?? []) as Suggestion[]);
    } catch (e) { setAiErr(e instanceof Error ? e.message : "Hata."); }
    finally { setAiBusy(false); }
  }

  function hospSearch(q: string) {
    setHospQ(q);
    if (hospDebounce.current) clearTimeout(hospDebounce.current);
    if (q.trim().length < 2) { setHospRes([]); setHospSearched(false); return; }
    setHospLoading(true);
    hospDebounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/registry/hospitals?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setHospRes((d.items ?? []) as HospitalHit[]);
      } catch { setHospRes([]); }
      setHospLoading(false);
      setHospSearched(true);
    }, 300);
  }

  const entries = Object.entries(sel);
  const totalTRY = entries.reduce((a, [, v]) => a + (v.priceTRY || 0), 0);
  const dMin = Math.round(Number(daysMin));
  const dMax = Math.round(Number(daysMax));
  const daysOk = Number.isFinite(dMin) && dMin >= 1 && Number.isFinite(dMax) && dMax >= dMin;
  const canSave = entries.length > 0 && daysOk && !saving;

  async function saveDecision() {
    setSaving(true); setSaveErr(""); setSaveMsg("");
    try {
      const r = await fetch(`/api/cases/${caseId}/recommendations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatments: entries.map(([code, v]) => ({ code, priceTRY: v.priceTRY })),
          treatmentDaysMin: dMin,
          treatmentDaysMax: dMax,
          hospitalRegistryId: hospId,
          hospitalName: hospName.trim() || null,
          sendToAgency: true, // Kaydet = dosya STA'ya iletilir (yeni akış)
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      if (!sentAt) setSentAt(new Date().toISOString());
      setSaveMsg(`✓ ${d.count} işlem kaydedildi — dosya Sağlık Turizmi Acentesine iletildi`);
      setTimeout(() => setSaveMsg(""), 6000);
    } catch (e) { setSaveErr(e instanceof Error ? e.message : "Bağlantı hatası"); }
    finally { setSaving(false); }
  }

  const results = catMode ? catRes.filter((p) => !(p.code in sel)) : branchResults;

  return (
    <div className="rounded-3xl border border-emerald-400/25 bg-[#161719] p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
        <Stethoscope size={15} /> Klinik Kodlama & Tedavi Kararı
      </div>
      <p className="mt-1 text-[11px] text-white/40">
        Tanıyı seçin → tanıya uygun işlemler aktifleşir → ücret ve süreyi belirleyin → Kaydet ile dosya
        Sağlık Turizmi Acentesine iletilir. FHIR: tanı → Condition (ICD-10), kimlik → Patient.identifier.
      </p>

      {/* ── 1 · Tanı (ICD-10) + hasta kimliği ── */}
      <div className="mt-4 rounded-2xl border border-white/10 p-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">1 · Tanı (ICD-10)</div>
        {icd10Options.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) { setIcd(e.target.value); setCodingSaved(false); setAiSugs(null); } }}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#1E1F22] px-3 py-2 text-sm text-white/65 outline-none focus:border-[#28C8D8]"
          >
            <option value="">Branşa özel yaygın tanı seç…</option>
            {icd10Options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} — {o.label}{mappedIcdCodes.has(o.code) ? " ★" : ""}
              </option>
            ))}
          </select>
        )}
        <input
          value={icd}
          onChange={(e) => { setIcd(e.target.value); setCodingSaved(false); setAiSugs(null); }}
          placeholder="ör. I20.9 (listeden seç ya da elle gir)"
          className="mt-1.5 w-full rounded-lg border border-white/15 px-3 py-2 text-sm uppercase outline-none focus:border-[#28C8D8]"
        />
        {selectedIcdLabel && <p className="mt-1 text-xs text-[#28C8D8]">✓ {selectedIcdLabel}{mappedIcdCodes.has(icdNorm) ? " · ★ eşlenmiş işlem önerileri var" : ""}</p>}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className="text-[11px] font-medium text-white/50">Hasta kimlik no</label>
            <div className="mt-1 flex gap-1.5">
              <select value={ptype} onChange={(e) => { setPtype(e.target.value); setCodingSaved(false); }} className="rounded-lg border border-white/15 px-2 py-2 text-sm outline-none focus:border-[#28C8D8]">
                <option value="TC">TC</option>
                <option value="PASSPORT">Pasaport</option>
                <option value="OTHER">Diğer</option>
              </select>
              <input value={pid} onChange={(e) => { setPid(e.target.value); setCodingSaved(false); }} placeholder="kimlik / pasaport no" className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#28C8D8]" />
            </div>
          </div>
          <button
            onClick={saveCoding}
            disabled={codingSaving}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#28C8D8] px-3 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-60"
          >
            {codingSaving ? <Loader2 size={14} className="animate-spin" /> : codingSaved ? <Check size={14} /> : <Save size={14} />}
            {codingSaved ? "Kaydedildi" : "Kodlamayı kaydet"}
          </button>
        </div>
        {codingErr && <p className="mt-2 text-xs text-red-300">{codingErr}</p>}
      </div>

      {/* ── 2 · Tedavi / işlem seçimi — tanı seçilince aktifleşir ── */}
      <div className={`mt-3 rounded-2xl border p-3.5 ${icdChosen ? "border-emerald-400/25" : "border-dashed border-white/10 bg-[#1E1F22]/60"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">
            2 · Tedavi / İşlem {icdChosen ? "" : "(önce tanı seçin)"}
          </div>
          {icdChosen && (
            <button
              onClick={askAi}
              disabled={aiBusy}
              title="Tanıya uygun işlem önerisi (AI — endikatif; karar doktora aittir)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/15 disabled:opacity-50"
            >
              {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI işlem önerisi
            </button>
          )}
        </div>

        {!icdChosen ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-white/40"><Lock size={13} /> Tanı ICD-10 kodu seçildiğinde tanıya uygun tedavi/işlem listesi burada aktifleşir.</p>
        ) : (
          <>
            {/* Tanıya eşlenmiş işlemler (statik küratörlü eşleme) */}
            {mappedProcs.filter((p) => !(p.code in sel)).length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] font-medium text-emerald-300">★ Tanıya uygun işlemler (öneri — tıklayıp ekleyin):</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {mappedProcs.filter((p) => !(p.code in sel)).map((p) => (
                    <button
                      key={p.code}
                      onClick={() => add(p)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/15"
                      title={`${p.code}${p.price ? ` · taban ${formatTRY(p.price)}` : ""}`}
                    >
                      <Plus size={11} /> {p.name.length > 46 ? p.name.slice(0, 44) + "…" : p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI önerileri (hibrit kanat) */}
            {aiErr && <div className="mt-2 text-[11px] text-red-300">{aiErr}</div>}
            {aiSugs && (
              <div className="mt-2 rounded-xl border border-violet-400/25 bg-violet-500/10 p-2.5">
                <div className="text-[11px] font-semibold text-violet-300"><Sparkles size={11} className="inline" /> AI önerileri (endikatif — karar sizindir):</div>
                {aiSugs.length === 0 && <p className="mt-1 text-[11px] text-white/40">AI bu tanı için havuzdan öneri çıkaramadı.</p>}
                <ul className="mt-1 space-y-1">
                  {aiSugs.filter((s) => !(s.code in sel)).map((s) => (
                    <li key={s.code} className="flex items-start justify-between gap-2 text-[12px]">
                      <span className="min-w-0 text-white/75">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-white/40"> · {s.code}</span>
                        <span className="block text-[11px] text-white/50">{s.reason}</span>
                      </span>
                      <button onClick={() => add(s)} className="shrink-0 rounded-md border border-violet-400/30 px-2 py-0.5 text-[11px] font-medium text-violet-300 hover:bg-violet-500/15">Ekle</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Arama: branş listesi / tüm katalog */}
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => catSearch(e.target.value)}
                  placeholder={catMode ? "Tüm katalogda ara…" : `${branchLabel} tedavisi ara…`}
                  className="w-full rounded-lg border border-white/15 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => { setCatMode((v) => !v); setCatRes([]); }}
                title="Branş dışı / sınıflandırılmamış işlemleri de ara"
                className={`shrink-0 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${catMode ? "border-emerald-400 bg-emerald-500/10 text-emerald-300" : "border-white/15 text-white/50 hover:bg-[#1E1F22]"}`}
              >
                Tüm katalog
              </button>
            </div>

            {query.trim().length >= (catMode ? 2 : 1) && (
              <div className="mt-1.5 max-h-44 divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
                {catLoading && <div className="px-3 py-2 text-xs text-white/40">Aranıyor…</div>}
                {!catLoading && results.length === 0 && <div className="px-3 py-2 text-xs text-white/40">Sonuç yok.</div>}
                {results.map((p) => (
                  <button key={p.code} onClick={() => add(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-500/10">
                    <span className="min-w-0">
                      <span className="block truncate text-white/75">{p.name}</span>
                      <span className="text-[11px] text-white/40">{p.code} · {p.price ? formatTRY(doctorPrices[p.code] ?? p.price) : "fiyat yok"}{doctorPrices[p.code] ? " · sizin fiyatınız" : ""}</span>
                    </span>
                    <Plus size={15} className="shrink-0 text-emerald-300" />
                  </button>
                ))}
              </div>
            )}

            {/* Seçilenler + slider ücret */}
            <div className="mt-3">
              {entries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/15 bg-[#1E1F22] px-3 py-3 text-center text-xs text-white/40">Henüz işlem eklenmedi. Önerilerden veya aramadan ekleyin.</p>
              ) : (
                <ul className="space-y-2">
                  {entries.map(([code, v]) => {
                    const floor = v.floor > 0 ? v.floor : 0;
                    const ceil = floor * CEIL_MULT;
                    const color = floor > 0 ? hueFor(v.priceTRY, floor, ceil) : "#28C8D8";
                    const step = floor > 0 ? Math.max(1, Math.round((ceil - floor) / 100)) : 1;
                    return (
                      <li key={code} className="rounded-lg border border-white/10 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-white/75">{v.name}</div>
                            <div className="text-[11px] text-white/40">{code}{floor > 0 ? ` · taban ${formatTRY(floor)} · tavan ${formatTRY(ceil)}` : ""}</div>
                          </div>
                          <button onClick={() => remove(code)} className="shrink-0 rounded p-1 text-white/40 hover:bg-red-500/10 hover:text-red-500"><X size={15} /></button>
                        </div>
                        {floor > 0 ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input type="range" min={floor} max={ceil} step={step} value={v.priceTRY} onChange={(e) => setPrice(code, Number(e.target.value))} className="h-2 flex-1 cursor-pointer" style={{ accentColor: color }} />
                            <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color }}>{formatTRY(v.priceTRY)}</span>
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[11px] text-white/40">Fiyat (₺):</span>
                            <input type="number" min={0} value={v.priceTRY || ""} onChange={(e) => setPrice(code, Math.max(0, Number(e.target.value)))} className="w-28 rounded-md border border-white/15 px-2 py-1 text-sm outline-none focus:border-emerald-500" />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {entries.length > 0 && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#1E1F22] px-3 py-2 text-sm">
                <span className="text-white/50">{entries.length} işlem · toplam</span>
                <span className="font-bold text-[#F4F5F3]">{formatTRY(totalTRY)} <span className="text-xs font-normal text-white/40">≈ ${tryToUsd(totalTRY, rate).toLocaleString("en-US")}</span></span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 3 · Öngörülen tedavi süresi ── */}
      <div className={`mt-3 rounded-2xl border p-3.5 ${icdChosen ? "border-white/10" : "border-dashed border-white/10 bg-[#1E1F22]/60"}`}>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">
          <CalendarRange size={13} /> 3 · Öngörülen tedavi süresi
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <input type="number" min={1} max={365} value={daysMin} onChange={(e) => setDaysMin(e.target.value)} placeholder="3" disabled={!icdChosen} className="w-20 rounded-lg border border-white/15 px-2.5 py-2 text-center outline-none focus:border-[#28C8D8] disabled:bg-[#1E1F22]" />
          <span className="text-white/40">–</span>
          <input type="number" min={1} max={365} value={daysMax} onChange={(e) => setDaysMax(e.target.value)} placeholder="7" disabled={!icdChosen} className="w-20 rounded-lg border border-white/15 px-2.5 py-2 text-center outline-none focus:border-[#28C8D8] disabled:bg-[#1E1F22]" />
          <span className="text-white/50">gün <span className="text-white/40">(ör. 3 – 7 gün)</span></span>
        </div>
        {icdChosen && daysMin && daysMax && !daysOk && <p className="mt-1.5 text-[11px] text-red-300">Geçerli bir gün aralığı girin (alt sınır ≥ 1, üst sınır ≥ alt sınır).</p>}
      </div>

      {/* ── 4 · Hastane seçimi (HealthTürkiye dizini) ── */}
      <div className={`mt-3 rounded-2xl border p-3.5 ${icdChosen ? "border-white/10" : "border-dashed border-white/10 bg-[#1E1F22]/60"}`}>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">
          <Building2 size={13} /> 4 · Hastane (isteğe bağlı)
        </div>
        {hospName ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#28C8D8]/25 bg-[#28C8D8]/10 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-medium text-white/75">{hospName}{hospId ? <span className="text-[11px] font-normal text-white/40"> · HealthTürkiye #{hospId}</span> : ""}</span>
            <button onClick={() => { setHospId(null); setHospName(""); }} className="shrink-0 rounded p-1 text-white/40 hover:bg-red-500/10 hover:text-red-500"><X size={14} /></button>
          </div>
        ) : (
          <>
            <div className="relative mt-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={hospQ}
                onChange={(e) => hospSearch(e.target.value)}
                placeholder="HealthTürkiye tesis dizininde ara (ad/şehir)…"
                disabled={!icdChosen}
                className="w-full rounded-lg border border-white/15 py-2 pl-8 pr-2 text-sm outline-none focus:border-teal-500 disabled:bg-[#1E1F22]"
              />
            </div>
            {hospLoading && <div className="mt-1.5 text-xs text-white/40">Aranıyor…</div>}
            {hospRes.length > 0 && (
              <ul className="mt-1.5 max-h-40 divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
                {hospRes.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => { setHospId(h.id); setHospName(h.name); setHospRes([]); setHospQ(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#28C8D8]/10">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 truncate text-white/75">{h.name}</span>
                          {/* Sağlık turizmi yetki belgesi (HealthTürkiye dizini) — yalnız pozitif rozet */}
                          {h.authorizationNumber && (
                            <span title="Sağlık turizmi yetki belgesi (HealthTürkiye)" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                              <ShieldCheck size={10} /> {h.authorizationNumber}
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-white/40">
                          {h.cityName ?? "—"}{h.facilityTypeName ? ` · ${h.facilityTypeName}` : ""}
                          {h.totalPersonnel ? ` · ${h.totalPersonnel} personel` : ""}
                          {h.cityHasAirport ? " · ✈ havalimanı" : ""}
                        </span>
                        {/* Detay zenginleştirmesi (HealthTürkiye): hizmet dilleri + akreditasyon adları */}
                        {((h.languages?.length ?? 0) > 0 || (h.accreditations?.length ?? 0) > 0) && (
                          <span className="block truncate text-[10px] text-white/40">
                            {(h.languages?.length ?? 0) > 0 && <>🌐 {h.languages!.slice(0, 4).join(", ")}{h.languages!.length > 4 ? ` +${h.languages!.length - 4}` : ""}</>}
                            {(h.languages?.length ?? 0) > 0 && (h.accreditations?.length ?? 0) > 0 && " · "}
                            {(h.accreditations?.length ?? 0) > 0 && <>🏅 {h.accreditations!.join(", ")}</>}
                          </span>
                        )}
                      </span>
                      <Plus size={14} className="shrink-0 text-[#28C8D8]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {hospSearched && !hospLoading && hospRes.length === 0 && hospQ.trim().length >= 2 && (
              <div className="mt-1.5 rounded-lg border border-dashed border-white/15 px-3 py-2 text-[11px] text-white/50">
                Dizinde sonuç yok. Hastane adını serbest yazmak için:{" "}
                <button onClick={() => { setHospName(hospQ.trim()); setHospId(null); }} className="font-semibold text-[#28C8D8] hover:underline">
                  &quot;{hospQ.trim()}&quot; olarak kullan
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 5 · Kaydet → STA'ya iletim ── */}
      {sentAt && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#28C8D8]/10 p-2.5 text-[11px] leading-relaxed text-[#28C8D8] ring-1 ring-[#28C8D8]/20">
          <Check size={14} className="mt-0.5 shrink-0" />
          <span>Dosya Sağlık Turizmi Acentesine iletildi ({new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(sentAt))}). Yeniden kaydetmek acente dosyasını günceller.</span>
        </div>
      )}
      {saveMsg && <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">{saveMsg}</div>}
      {saveErr && <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300">{saveErr}</div>}
      <button
        onClick={saveDecision}
        disabled={!canSave}
        title={!icdChosen ? "Önce tanı seçin" : entries.length === 0 ? "En az bir işlem ekleyin" : !daysOk ? "Öngörülen tedavi süresini girin" : "Tedavi kararını kaydet — dosya acenteye iletilir"}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : sentAt ? <Send size={15} /> : <ClipboardList size={15} />}
        {saving ? "Kaydediliyor…" : sentAt ? "Güncelle (acente dosyası güncellenir)" : "Kaydet — Sağlık Turizmi Acentesine ilet"}
      </button>
      <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
        Acenteye YALNIZ: hasta adı, ülke, dil, iletişim tercihi, seçtiğiniz işlem ve ücretler, öngörülen süre
        ve hastane gider. Tıbbi belge, görüntüleme, test sonucu ve şikâyet metni acenteyle PAYLAŞILMAZ.
      </p>
    </div>
  );
}
