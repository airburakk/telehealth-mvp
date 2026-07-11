"use client";

import { useEffect, useState } from "react";
import {
  FileText, ShieldCheck, GraduationCap, Award, Upload, Trash2, Loader2, Check, AlertTriangle,
} from "lucide-react";

// M5 — Doktor mesleki belge yükleme bölümü. Diploma + MMSS ZORUNLU (yüklenip MMSS bilgileri
// tamamlanmadan hesap aktifleşmez); sertifika/akademik ihtiyari. İçerik base64 → /api/doctor/documents.
// MMSS metadata (teminat limiti = M3 Katman 3 girdisi) → /api/doctor/mmss.

export interface DocMeta { id: string; type: string; label: string; mimeType: string }
export interface MmssInitial {
  insurer: string | null;
  coverageLimit: number | null;
  currency: string | null;
  validUntil: string | null; // ISO (yyyy-mm-dd kısmı kullanılır)
  policyNoSet: boolean; // poliçe no kayıtlı mı (değer şifreli → gösterilmez)
}

const TYPES: { type: string; label: string; desc: string; required: boolean; Icon: typeof FileText }[] = [
  { type: "DIPLOMA", label: "Tıp Diploması", desc: "Diploma / tescil belgesi", required: true, Icon: GraduationCap },
  { type: "MMSS", label: "Mesleki Mali Sorumluluk Sigortası (MMSS)", desc: "Zorunlu mesleki sorumluluk poliçesi", required: true, Icon: ShieldCheck },
  { type: "CERTIFICATE", label: "Sertifikalar", desc: "Mesleki sertifika / üyelik (ihtiyari)", required: false, Icon: Award },
  { type: "ACADEMIC", label: "Akademik Çalışmalar", desc: "Yayın / akademik belge (ihtiyari)", required: false, Icon: FileText },
];

const ACCEPT = "application/pdf,image/jpeg,image/png";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Dosya okunamadı."));
    fr.readAsDataURL(file);
  });
}

export function DoctorDocuments({
  initialDocs,
  initialMmss,
  onActivationChange,
}: {
  initialDocs: DocMeta[];
  initialMmss: MmssInitial;
  onActivationChange?: (activated: boolean) => void;
}) {
  const [docs, setDocs] = useState<DocMeta[]>(initialDocs);
  const [busy, setBusy] = useState<string | null>(null); // yüklenen/silinen tip
  const [err, setErr] = useState("");

  // MMSS metadata formu
  const [insurer, setInsurer] = useState(initialMmss.insurer ?? "");
  const [policyNo, setPolicyNo] = useState("");
  const [coverageLimit, setCoverageLimit] = useState(initialMmss.coverageLimit ? String(initialMmss.coverageLimit) : "");
  const [currency, setCurrency] = useState(initialMmss.currency ?? "TRY");
  const [validUntil, setValidUntil] = useState(initialMmss.validUntil ? initialMmss.validUntil.slice(0, 10) : "");
  const [mmssSaved, setMmssSaved] = useState(initialMmss.policyNoSet && !!initialMmss.coverageLimit);
  const [savingMmss, setSavingMmss] = useState(false);

  const has = (t: string) => docs.some((d) => d.type === t);
  const mmssMetaComplete = !!insurer.trim() && coverageLimit !== "" && Number(coverageLimit) > 0 && (policyNo.trim() !== "" || initialMmss.policyNoSet) && mmssSaved;
  const activated = has("DIPLOMA") && has("MMSS") && mmssMetaComplete;

  // activation değişimini parent'a bildir (onboarding "geç" butonu)
  useEffect(() => { onActivationChange?.(activated); }, [activated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(type: string, file: File | null) {
    if (!file) return;
    setErr("");
    setBusy(type);
    try {
      const content = await fileToDataUrl(file);
      const r = await fetch("/api/doctor/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label: file.name, mimeType: file.type || "application/octet-stream", content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Yüklenemedi.");
      // zorunlu/tekil tip eskisini değiştirir → aynı tipi listeden çıkar, yenisini ekle
      setDocs((prev) => [{ id: d.id, type: d.type, label: d.label, mimeType: d.mimeType }, ...prev.filter((x) => !(x.type === type && (type === "DIPLOMA" || type === "MMSS")))]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(doc: DocMeta) {
    setErr("");
    setBusy(doc.type);
    try {
      const r = await fetch(`/api/doctor/documents?id=${encodeURIComponent(doc.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Silinemedi.");
      setDocs((prev) => prev.filter((x) => x.id !== doc.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(null);
    }
  }

  async function saveMmss() {
    setErr("");
    setSavingMmss(true);
    try {
      const r = await fetch("/api/doctor/mmss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insurer, policyNo, coverageLimit: Number(coverageLimit), currency, validUntil: validUntil || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setMmssSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setSavingMmss(false);
    }
  }

  return (
    <div className="space-y-3">
      {TYPES.map(({ type, label, desc, required, Icon }) => {
        const mine = docs.filter((d) => d.type === type);
        const ok = mine.length > 0;
        return (
          <div key={type} className={`rounded-3xl border p-4 ${required && !ok ? "border-amber-400/25 bg-amber-500/10" : ok ? "border-emerald-400/25 bg-emerald-500/10" : "border-white/10 bg-[#161719]"}`}>
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${ok ? "bg-emerald-500 text-white" : required ? "bg-amber-400 text-white" : "bg-white/10 text-white/50"}`}>
                {ok ? <Check size={18} /> : <Icon size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#F4F5F3]">
                  {label}
                  {required ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Zorunlu</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/50">İhtiyari</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-white/50">{desc}</p>

                {/* Yüklü belgeler */}
                {mine.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {mine.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#161719] px-3 py-1.5 text-xs ring-1 ring-white/10">
                        <span className="flex min-w-0 items-center gap-1.5 text-white/65">
                          <FileText size={13} className="shrink-0 text-white/40" />
                          <span className="truncate">{d.label}</span>
                        </span>
                        <button onClick={() => remove(d)} disabled={busy === type} className="shrink-0 text-white/40 hover:text-red-300 disabled:opacity-50" aria-label="Kaldır">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Yükleme butonu */}
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#161719] px-3 py-1.5 text-xs font-medium text-white/65 hover:border-[#28C8D8] hover:text-[#17919E]">
                  {busy === type ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {ok && (type === "DIPLOMA" || type === "MMSS") ? "Değiştir" : "Dosya yükle"}
                  <input type="file" accept={ACCEPT} className="hidden" disabled={busy === type}
                    onChange={(e) => { upload(type, e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
                <span className="ml-2 text-[10px] text-white/40">PDF / JPG / PNG · ~8 MB'a kadar</span>
              </div>
            </div>

            {/* MMSS poliçe bilgileri formu (yalnız MMSS kartında) */}
            {type === "MMSS" && (
              <div className="mt-3 rounded-2xl bg-[#161719] p-3 ring-1 ring-white/10">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Poliçe Bilgileri</div>
                <p className="mt-0.5 text-[11px] text-white/40">Teminat limiti, malpraktis/komplikasyon ek teminat hesabında kullanılır.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Field label="Sigorta şirketi">
                    <input value={insurer} onChange={(e) => { setInsurer(e.target.value); setMmssSaved(false); }} placeholder="Örn. Allianz" className={inputCls} />
                  </Field>
                  <Field label={initialMmss.policyNoSet ? "Poliçe no (kayıtlı — değiştirmek için girin)" : "Poliçe no"}>
                    <input value={policyNo} onChange={(e) => { setPolicyNo(e.target.value); setMmssSaved(false); }} placeholder={initialMmss.policyNoSet ? "•••• kayıtlı" : "Poliçe numarası"} className={inputCls} />
                  </Field>
                  <Field label="Teminat limiti">
                    <div className="flex gap-1.5">
                      <input value={coverageLimit} onChange={(e) => { setCoverageLimit(e.target.value.replace(/[^0-9]/g, "")); setMmssSaved(false); }} inputMode="numeric" placeholder="Örn. 2000000" className={inputCls} />
                      <select value={currency} onChange={(e) => { setCurrency(e.target.value); setMmssSaved(false); }} className="rounded-lg border border-white/15 px-2 text-sm">
                        <option value="TRY">₺</option>
                        <option value="USD">$</option>
                      </select>
                    </div>
                  </Field>
                  <Field label="Geçerlilik bitişi (ops.)">
                    <input type="date" value={validUntil} onChange={(e) => { setValidUntil(e.target.value); setMmssSaved(false); }} className={inputCls} />
                  </Field>
                </div>
                <button onClick={saveMmss} disabled={savingMmss || !insurer.trim() || coverageLimit === "" || (!policyNo.trim() && !initialMmss.policyNoSet)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-3 py-1.5 text-xs font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50">
                  {savingMmss ? <Loader2 size={13} className="animate-spin" /> : mmssSaved ? <Check size={13} /> : <ShieldCheck size={13} />}
                  {mmssSaved ? "Bilgiler kayıtlı" : "Bilgileri kaydet"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {err && (
        <p className="flex items-center gap-1.5 text-sm text-red-300"><AlertTriangle size={14} /> {err}</p>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-white/15 px-2.5 py-1.5 text-sm focus:border-[#28C8D8] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}
