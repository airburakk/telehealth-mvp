"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, LANGUAGES, langDir } from "@/lib/constants";
import { useT } from "@/components/useT";
import { HeartHandshake, Globe, Loader2, ArrowRight } from "lucide-react";

// Ücretsiz Sağlık Hizmeti ön-triyaj — kısa, ücret kapısı YOK. Başvuru → eşleşme varsa görüşme, yoksa bekleme odası.
const STATIC_UI = [
  "Ücretsiz Sağlık Hizmeti Başvurusu",
  "Maddi imkânı kısıtlı hastalar için akredite gönüllü doktorlarla ücretsiz video konsültasyon.",
  "Arayüz dili", "Hasta Adı (veya yakını)", "Örn. Amina B.", "Ülke", "Dil",
  "Şikayetiniz / Semptomlar",
  "Örn. Çocuğumda iki haftadır geçmeyen öksürük ve ateş var; doktora erişimimiz yok.",
  "Şikayet süresi (opsiyonel)", "Örn. 2 hafta",
  "Bu görüşme tamamen ücretsizdir. Gönüllü doktorlarımiz kontenjanları dolana kadar başvuruları sırayla karşılar.",
  "Lütfen şikayetinizi biraz daha ayrıntılı yazın.",
  "Başvur ve eşleş", "Başvurunuz oluşturuluyor…",
  "Ücretsiz Sağlık Hizmeti çevrimiçi", "gönüllü doktor şu an müsait", "Şu an çevrimiçi gönüllü doktor yok",
  "Bir doktor çevrimiçi olduğunda başvurabilirsiniz; havuzdayken bir doktor müsait olunca size bildirim göndeririz.",
  "Müsaitlik kontrol ediliyor…",
];

export default function FreeCareApplyPage() {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [country, setCountry] = useState("TR");
  const [language, setLanguage] = useState("Türkçe");
  const [uiLang, setUiLang] = useState("Türkçe");
  const [symptoms, setSymptoms] = useState("");
  const [durationText, setDurationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/free-care/status");
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setOnline(typeof d.online === "number" ? d.online : 0);
      } catch {
        /* sessiz — sonraki tick tekrar dener */
      }
    };
    tick();
    const iv = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const tTexts = useMemo(() => STATIC_UI, []);
  const { t } = useT(uiLang, tTexts);

  async function submit() {
    setError("");
    if (symptoms.trim().length < 8) return setError("Lütfen şikayetinizi biraz daha ayrıntılı yazın.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/free-care/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, country, language, symptoms, durationText, consent: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Hata");
      const d = await res.json();
      if (d.consultationId) router.push(`/gorusme/${d.consultationId}`);
      else router.push(`/ucretsiz-saglik/bekleme?caseId=${d.caseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başvuru oluşturulamadı.");
      setSubmitting(false);
    }
  }

  return (
    <div dir={langDir(uiLang)} className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0]/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0E8A95]">
            <HeartHandshake size={14} /> Ücretsiz Sağlık Hizmeti
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#101010]">{t("Ücretsiz Sağlık Hizmeti Başvurusu")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Maddi imkânı kısıtlı hastalar için akredite gönüllü doktorlarla ücretsiz video konsültasyon.")}
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
          <Globe size={14} />
          <span className="hidden sm:inline">{t("Arayüz dili")}</span>
          <select value={uiLang} onChange={(e) => setUiLang(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#14C3D0]">
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <Field label={t("Hasta Adı (veya yakını)")}>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder={t("Örn. Amina B.")} className="inp" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("Ülke")}>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                const c = COUNTRIES.find((x) => x.code === e.target.value);
                if (c) { setLanguage(c.langs[0]); setUiLang(c.langs[0]); }
              }}
              className="inp"
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </Field>
          <Field label={t("Dil")}>
            <select value={language} onChange={(e) => { setLanguage(e.target.value); setUiLang(e.target.value); }} className="inp">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("Şikayetiniz / Semptomlar")}>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            rows={5}
            placeholder={t("Örn. Çocuğumda iki haftadır geçmeyen öksürük ve ateş var; doktora erişimimiz yok.")}
            className="inp resize-none"
          />
        </Field>
        <Field label={t("Şikayet süresi (opsiyonel)")}>
          <input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder={t("Örn. 2 hafta")} className="inp" />
        </Field>

        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-[13px] leading-relaxed text-teal-800">
          {t("Bu görüşme tamamen ücretsizdir. Gönüllü doktorlarımiz kontenjanları dolana kadar başvuruları sırayla karşılar.")}
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{t(error)}</div>}

        {/* Çevrimiçi/çevrimdışı indikatörü — buton aktifliği buna bağlı */}
        <div className="flex items-center gap-2 text-[13px]">
          <span className={`h-2.5 w-2.5 rounded-full ${online === null ? "bg-slate-300" : online > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-slate-600">
            {online === null
              ? t("Müsaitlik kontrol ediliyor…")
              : online > 0
                ? `${t("Ücretsiz Sağlık Hizmeti çevrimiçi")} · ${online} ${t("gönüllü doktor şu an müsait")}`
                : t("Şu an çevrimiçi gönüllü doktor yok")}
          </span>
        </div>
        {online === 0 && (
          <p className="-mt-1 text-xs leading-relaxed text-slate-400">
            {t("Bir doktor çevrimiçi olduğunda başvurabilirsiniz; havuzdayken bir doktor müsait olunca size bildirim göndeririz.")}
          </p>
        )}

        <button
          onClick={submit}
          disabled={submitting || !online || online <= 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-3 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {submitting ? t("Başvurunuz oluşturuluyor…") : t("Başvur ve eşleş")}
        </button>
      </div>

      <style>{`
        .inp { width:100%; border:1px solid #cbd5e1; border-radius:0.6rem; padding:0.55rem 0.75rem; font-size:0.9rem; outline:none; background:#fff; }
        .inp:focus { border-color:#14C3D0; box-shadow:0 0 0 3px rgba(20,195,208,0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
