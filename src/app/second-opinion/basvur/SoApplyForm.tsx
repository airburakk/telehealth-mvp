"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES } from "@/lib/triage";
import { SO_DURATION_COPY, SO_FEE_USD } from "@/lib/second-opinion";
import { useT } from "@/components/useT";
import { useSoLang, SoLangSelect } from "@/components/SoLocale";
import { Stethoscope, Clock, Video, ArrowRight, Loader2 } from "lucide-react";
import { langDir } from "@/lib/constants";

const D = SO_DURATION_COPY.tr;
const FEE_LINE = `Ücret: ${SO_FEE_USD} USD — peşin ve tek ödeme. Yazılı rapor ve video görüşme dahildir.`;
// TR kanonik metinler — useT ile hedef dile çevrilir (cache + Claude). Türkçe'de aynen kalır.
const S = {
  eyebrow: "İkinci Görüş",
  title: "Second Opinion Ön Değerlendirme",
  intro: "Mevcut tanınıza ilişkin belgelerinizi yükleyin; alanında uzman bir hekim dosyanızı bağımsız olarak değerlendirsin. Süreç yazılı bir ikinci görüş ve ardından bir video görüşmeyle tamamlanır.",
  reportLabel: D.reportLabel,
  reportValue: D.reportValue,
  videoLabel: "Video görüşme",
  videoText: D.video,
  branchLabel: "İlgili tıbbi branş",
  branchPlaceholder: "Branş seçin…",
  diagLabel: "Mevcut tanınız / durumunuz",
  diagHint: "Konulan tanıyı, ne zaman ve nasıl tanı aldığınızı kısaca özetleyin.",
  diagPh: "Örn. 3 ay önce sol meme invaziv duktal karsinom tanısı kondu; cerrahi öneriliyor…",
  consent: "Yükleyeceğim tıbbi belgelerin özel nitelikli kişisel veri olduğunu biliyor; ikinci görüş değerlendirmesi amacıyla işlenmesine ve yetkili sağlık personeliyle paylaşılmasına açık rıza veriyorum.",
  consentNote: "(KVKK aydınlatma metni — taslak)",
  submit: "Devam et — belge yükleme",
  errGeneric: "Bir hata oluştu.",
} as const;

export function SoApplyForm() {
  const router = useRouter();
  const [lang, setLang] = useSoLang();
  const texts = useMemo(() => [...Object.values(S), FEE_LINE, ...BRANCHES.map((b) => b.label)], []);
  const { t } = useT(lang, texts);

  const [diagnosisSummary, setDiagnosisSummary] = useState("");
  const [branch, setBranch] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = consent && diagnosisSummary.trim().length >= 10 && branch && !submitting;

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/second-opinion/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent, diagnosisSummary, branch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || S.errGeneric);
      router.push(`/second-opinion/vaka/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(S.errGeneric));
      setSubmitting(false);
    }
  }

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0]/10 px-4 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#0E8A95]">
          <Stethoscope size={15} /> {t(S.eyebrow)}
        </span>
        <SoLangSelect lang={lang} onChange={setLang} />
      </div>
      <h1 className="mt-4 text-3xl font-bold text-[#101010]">{t(S.title)}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{t(S.intro)}</p>

      {/* §12.2 — süre bilgilendirmesi (tek kaynak: lib/second-opinion; useT ile çok dilli) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock size={14} /> {t(S.reportLabel)}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#101010]">{t(S.reportValue)}</div>
        </div>
        <div className="rounded-2xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.06] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0E8A95]">
            <Video size={14} /> {t(S.videoLabel)}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t(S.videoText)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{t(FEE_LINE)}</div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">{t(S.branchLabel)}</label>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#14C3D0] focus:outline-none focus:ring-2 focus:ring-[#14C3D0]/30"
        >
          <option value="">{t(S.branchPlaceholder)}</option>
          {BRANCHES.map((b) => (
            <option key={b.key} value={b.key}>{t(b.label)}</option>
          ))}
        </select>

        <label className="mt-5 block text-sm font-semibold text-slate-700">{t(S.diagLabel)}</label>
        <p className="text-xs text-slate-500">{t(S.diagHint)}</p>
        <textarea
          value={diagnosisSummary}
          onChange={(e) => setDiagnosisSummary(e.target.value)}
          rows={5}
          placeholder={t(S.diagPh)}
          className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#14C3D0] focus:outline-none focus:ring-2 focus:ring-[#14C3D0]/30"
        />

        {/* KVKK açık rıza kapısı (§8) — mekanizma; nihai hukuki metin kullanıcıda */}
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#14C3D0]" />
          <span className="text-[13px] leading-relaxed text-slate-600">
            {t(S.consent)} <span className="text-slate-400">{t(S.consentNote)}</span>
          </span>
        </label>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14C3D0] px-6 py-3 text-[15px] font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 size={17} className="animate-spin" /> : <>{t(S.submit)} <ArrowRight size={17} /></>}
        </button>
      </div>
    </div>
  );
}
