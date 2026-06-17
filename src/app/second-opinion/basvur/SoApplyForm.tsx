"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES } from "@/lib/triage";
import { ArrowRight, Loader2 } from "lucide-react";

// İkinci görüş başvurusu — ilk adım: KVKK açık rıza + tanı özeti + branş → DRAFT vaka oluşturur,
// ardından vaka hub'ına (belge yükleme + ödeme) yönlendirir.
export function SoApplyForm() {
  const router = useRouter();
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
      if (!res.ok) throw new Error(data.error || "Başvuru oluşturulamadı.");
      router.push(`/second-opinion/vaka/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold text-slate-700">İlgili tıbbi branş</label>
      <select
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#14C3D0] focus:outline-none focus:ring-2 focus:ring-[#14C3D0]/30"
      >
        <option value="">Branş seçin…</option>
        {BRANCHES.map((b) => (
          <option key={b.key} value={b.key}>{b.label}</option>
        ))}
      </select>

      <label className="mt-5 block text-sm font-semibold text-slate-700">Mevcut tanınız / durumunuz</label>
      <p className="text-xs text-slate-500">Konulan tanıyı, ne zaman ve nasıl tanı aldığınızı kısaca özetleyin.</p>
      <textarea
        value={diagnosisSummary}
        onChange={(e) => setDiagnosisSummary(e.target.value)}
        rows={5}
        placeholder="Örn. 3 ay önce sol meme invaziv duktal karsinom tanısı kondu; cerrahi öneriliyor…"
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#14C3D0] focus:outline-none focus:ring-2 focus:ring-[#14C3D0]/30"
      />

      {/* KVKK açık rıza kapısı (§8) — mekanizma; nihai hukuki metin kullanıcı tarafından verilecek (taslak). */}
      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#14C3D0]"
        />
        <span className="text-[13px] leading-relaxed text-slate-600">
          Yükleyeceğim tıbbi belgelerin <strong className="text-slate-700">özel nitelikli kişisel veri</strong> olduğunu
          biliyor; ikinci görüş değerlendirmesi amacıyla işlenmesine ve yetkili sağlık personeliyle paylaşılmasına
          <strong className="text-slate-700"> açık rıza</strong> veriyorum. <span className="text-slate-400">(KVKK aydınlatma metni — taslak)</span>
        </span>
      </label>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14C3D0] px-6 py-3 text-[15px] font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 size={17} className="animate-spin" /> : <>Devam et — belge yükleme <ArrowRight size={17} /></>}
      </button>
    </div>
  );
}
