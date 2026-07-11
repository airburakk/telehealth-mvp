"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";
import { useT } from "@/components/useT";
import { usePatientLang } from "@/components/PatientLocale";
import { JourneyIntakeShell } from "@/components/JourneyIntakeShell";
import { ContactPrefFields, CONTACT_PREF_TEXTS, type ContactPref } from "@/components/ContactPrefFields";
import { HeartHandshake, Loader2, ArrowRight } from "lucide-react";

// Ücretsiz Sağlık Hizmeti ön-triyaj — kısa, ücret kapısı YOK. Başvuru → eşleşme varsa görüşme, yoksa bekleme odası.
const STATIC_UI = [
  "Ücretsiz Sağlık Hizmeti",
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
  const [phone, setPhone] = useState(""); // FAZ 8 — hasta iletişim
  const [contactPref, setContactPref] = useState<ContactPref>("APP");
  const [uiLang, setUiLang] = usePatientLang(); // /basla'da seçilen dil (air_lang) taşınır
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

  const tTexts = useMemo(() => [...STATIC_UI, ...CONTACT_PREF_TEXTS], []);
  const { t } = useT(uiLang, tTexts);

  async function submit() {
    setError("");
    if (symptoms.trim().length < 8) return setError("Lütfen şikayetinizi biraz daha ayrıntılı yazın.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/free-care/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, country, language, symptoms, durationText, consent: true, patientPhone: phone, contactPreference: contactPref }),
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
    <JourneyIntakeShell icon={HeartHandshake} eyebrow={t("Ücretsiz Sağlık Hizmeti")} title={t("Ücretsiz Sağlık Hizmeti Başvurusu")} intro={t("Maddi imkânı kısıtlı hastalar için akredite gönüllü doktorlarla ücretsiz video konsültasyon.")} lang={uiLang} onLangChange={setUiLang} journey="FREE_CARE" stage={1}>

      <div className="mt-7 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm space-y-4">
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
        {/* FAZ 8 — telefon + iletişim tercihi (4 senaryonun ortak Ön Bilgi alanı) */}
        <ContactPrefFields phone={phone} onPhone={setPhone} pref={contactPref} onPref={setContactPref} t={t} />
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

        <div className="rounded-2xl border border-[#28C8D8]/25 bg-[#28C8D8]/10 px-4 py-3 text-[13px] leading-relaxed text-[#28C8D8]">
          {t("Bu görüşme tamamen ücretsizdir. Gönüllü doktorlarımiz kontenjanları dolana kadar başvuruları sırayla karşılar.")}
        </div>

        {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{t(error)}</div>}

        {/* Çevrimiçi/çevrimdışı indikatörü — buton aktifliği buna bağlı */}
        <div className="flex items-center gap-2 text-[13px]">
          <span className={`h-2.5 w-2.5 rounded-full ${online === null ? "bg-white/20" : online > 0 ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-white/65">
            {online === null
              ? t("Müsaitlik kontrol ediliyor…")
              : online > 0
                ? `${t("Ücretsiz Sağlık Hizmeti çevrimiçi")} · ${online} ${t("gönüllü doktor şu an müsait")}`
                : t("Şu an çevrimiçi gönüllü doktor yok")}
          </span>
        </div>
        {online === 0 && (
          <p className="-mt-1 text-xs leading-relaxed text-white/40">
            {t("Bir doktor çevrimiçi olduğunda başvurabilirsiniz; havuzdayken bir doktor müsait olunca size bildirim göndeririz.")}
          </p>
        )}

        <button
          onClick={submit}
          disabled={submitting || !online || online <= 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-3 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {submitting ? t("Başvurunuz oluşturuluyor…") : t("Başvur ve eşleş")}
        </button>
      </div>

      <style>{`
        .inp { width:100%; border:1px solid rgba(255,255,255,0.15); border-radius:0.6rem; padding:0.55rem 0.75rem; font-size:0.9rem; outline:none; background:#1E1F22; color:#F4F5F3; }
        .inp::placeholder { color:rgba(255,255,255,0.35); }
        .inp:focus { border-color:#28C8D8; box-shadow:0 0 0 3px rgba(40,200,216,0.15); }
      `}</style>
    </JourneyIntakeShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/75">{label}</span>
      {children}
    </label>
  );
}
