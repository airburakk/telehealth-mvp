"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Stethoscope, Inbox, Loader2, ArrowRight, Check, BadgeCheck, Lock, ShieldAlert } from "lucide-react";
import { DoctorDocuments, type DocMeta, type MmssInitial } from "@/components/DoctorDocuments";

// M5 — İlk-giriş onboarding kapısı (client). Önce ZORUNLU mesleki belgeler (diploma + MMSS) yüklenir
// (yüklenmeden hesap aktifleşmez), sonra Pro Bono + Partner Konsültasyon opt-in toplanır. Kaydedince /doktor'a geçer.
export function OnboardingForm({
  doctorName,
  soOpen,
  initialProBono,
  initialConsult,
  initialDocs,
  initialMmss,
}: {
  doctorName: string;
  soOpen: boolean;
  initialProBono: boolean;
  initialConsult: boolean;
  initialDocs: DocMeta[];
  initialMmss: MmssInitial;
}) {
  const router = useRouter();
  const [proBono, setProBono] = useState(initialProBono);
  const [consult, setConsult] = useState(initialConsult);
  const [docsReady, setDocsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function finish() {
    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/doctor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proBonoOptIn: proBono, consultOptIn: consult }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      router.push("/doktor");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#101010]">Hoş geldiniz, {doctorName}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Doktor Ana Sayfanız tercihinize göre düzenlenir. Aşağıdaki birimlere katılmak isteyip
          istemediğinizi seçin — dilediğiniz zaman profilinizden değiştirebilirsiniz.
        </p>
      </div>

      {/* ── Zorunlu mesleki belgeler — hesap aktivasyon kapısı ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm font-bold text-[#101010]">
          <ShieldAlert size={16} className="text-amber-500" /> Mesleki Belgeler
        </div>
        <p className="mt-1 text-xs text-slate-500">
          <strong>Tıp diploması</strong> ve <strong>Mesleki Mali Sorumluluk Sigortası (MMSS)</strong> poliçenizi
          yüklemeden hesabınız aktifleşmez. Sertifika ve akademik çalışmalar ihtiyaridir.
        </p>
        <div className="mt-3">
          <DoctorDocuments initialDocs={initialDocs} initialMmss={initialMmss} onActivationChange={setDocsReady} />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {/* İkinci Görüş — ünvan kapısı (seçim değil, bilgi) */}
        <div className={`rounded-3xl border p-5 ${soOpen ? "border-[#14C3D0]/40 bg-[#14C3D0]/[0.06]" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${soOpen ? "bg-[#14C3D0] text-[#101010]" : "bg-slate-300 text-white"}`}>
              {soOpen ? <Stethoscope size={18} /> : <Lock size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#101010]">
                İkinci Görüş Paneli {soOpen && <BadgeCheck size={15} className="text-teal-600" />}
              </div>
              {soOpen ? (
                <p className="mt-1 text-xs text-slate-600">
                  Ünvanınız uygun — İkinci Görüş paneliniz <strong>otomatik açık</strong>. Tanı konmuş
                  hastaların belgelerini inceleyip yazılı görüş ve video görüşme sunabilirsiniz.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  İkinci Görüş paneli yalnız <strong>Doçent / Profesör</strong> ünvanlı hekimlere açılır;
                  hesabınızda görüntülenmeyecek.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pro Bono opt-in */}
        <OptCard
          active={proBono}
          onToggle={() => setProBono((v) => !v)}
          icon={<HeartHandshake size={18} />}
          title="Pro Bono — Ücretsiz Konsültasyon"
          desc="Sağlığa erişimi kısıtlı hastalarla gönüllü, ücretsiz video görüşmesinde buluşun."
          benefit="Avantaj: profil itibar rozeti (“Pro Bono Gönüllüsü”), dizinlerde öne çıkma ve etik katkı görünürlüğü. Haftalık kontenjanı kendiniz belirlersiniz."
        />

        {/* Partner Konsültasyon opt-in */}
        <OptCard
          active={consult}
          onToggle={() => setConsult((v) => !v)}
          icon={<Inbox size={18} />}
          title="Konsültasyon Talepleri — Partner Doktorlar"
          desc="Partner (yurtdışı) doktorlardan gelen, anonimleştirilmiş hasta dosyalarına görüş verin."
          benefit="Yanıtladığınız her konsültasyon talebi için ödeme alırsınız (yanıt başına; demo ortamında simüledir). Talepleri kendi branşınızla sınırlı veya genel havuzdan görebilirsiniz."
        />
      </div>

      {err && <p className="mt-4 text-center text-sm text-red-600">{err}</p>}

      {!docsReady && (
        <p className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-xs font-medium text-amber-700 ring-1 ring-amber-100">
          <ShieldAlert size={14} /> Devam etmek için tıp diploması ve MMSS poliçenizi (teminat limiti dahil) tamamlayın.
        </p>
      )}

      <button
        onClick={finish}
        disabled={saving || !docsReady}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14C3D0] px-4 py-3 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Ana Sayfama geç
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">
        Klinik Nöbet ve Haberler pencereleri her hekimin ana sayfasında bulunur.
      </p>
    </div>
  );
}

function OptCard({
  active,
  onToggle,
  icon,
  title,
  desc,
  benefit,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  benefit: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`w-full rounded-3xl border p-5 text-left transition ${active ? "border-[#14C3D0] bg-[#14C3D0]/[0.06]" : "border-slate-200 bg-white hover:border-[#14C3D0]/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${active ? "bg-[#14C3D0] text-[#101010]" : "bg-slate-100 text-slate-500"}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#101010]">{title}</span>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${active ? "border-[#14C3D0] bg-[#14C3D0] text-[#101010]" : "border-slate-300 bg-white text-transparent"}`}>
              <Check size={14} />
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{desc}</p>
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">{benefit}</p>
        </div>
      </div>
    </button>
  );
}
