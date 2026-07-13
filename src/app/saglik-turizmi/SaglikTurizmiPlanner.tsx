"use client";

// Sağlık Turizmi hasta-yüzü planlayıcı — iki adımlı intake (2026-07-12 yeniden tasarım, kullanıcı kararı).
// Branş Doktoru (triyaj) akışına benzer: (1) Ön Bilgi (kimlik + iletişim + sağlık durumu/hedef) → Devam
// AI otomatik branş atar; (2) Tedavi Alanı (31 branşın tamamı, AI'nın atadığı seçili gelir, hasta
// değiştirebilir) → Talep Oluştur. Talep, seçilen branşın DOKTOR HAVUZUNA düşer (mevcut teklif/video/
// anlaşma → doktor fiyat → acente dosyası zinciri aynen). Talep sonrası hastaya AURA-dışı sorumluluk
// reddi mesajı gider (iletişim tercihi üzerinden; lib/tourism-disclaimer). Fiyat önizlemesi/paket
// seviyesi/konaklama tamamen kaldırıldı — kesin plan ve fiyat DAİMA görüşme sonrası (klinik-önce).
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, Stethoscope, ClipboardList, ArrowRight, ArrowLeft, Loader2, ShieldAlert, CheckCircle2, Sparkles } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang } from "@/components/PatientLocale";
import { JourneyIntakeShell } from "@/components/JourneyIntakeShell";
import { ContactPrefFields, CONTACT_PREF_TEXTS, type ContactPref } from "@/components/ContactPrefFields";
import { usePatientProfile, ProfileStrip, profileComplete, PROFILE_STRIP_TEXTS } from "@/components/ProfilePrefill";
import { DictationButton, DICTATION_TEXTS } from "@/components/DictationButton";
import { COUNTRIES, countryName } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";
import { TOURISM_DISCLAIMER_TITLE, TOURISM_DISCLAIMER_BODY } from "@/lib/tourism-disclaimer";

const TEXTS = [
  "Sağlık Turizmi",
  "Sağlık Turizmini Planla",
  "Tedavi hedefinizi ve tercihlerinizi paylaşın; kesin planı ve fiyatı görüşmede birlikte netleştirin.",
  "Ön Bilgi",
  "Tedavi Alanı",
  "Hasta Adı (veya yakını)",
  "Örn. Karim B.",
  "Ülke",
  "Sağlık durumunuz veya hedefiniz nedir?",
  "Örn. saç ekimi düşünüyorum; ön bölgede belirgin seyrekleşme var.",
  "Devam",
  "Lütfen hasta adını girin.",
  "Lütfen sağlık durumunuzu veya hedefinizi birkaç kelimeyle yazın.",
  "Analiz yapılamadı, lütfen tekrar deneyin.",
  "Verdiğiniz bilgilere göre önerilen tedavi alanı aşağıda seçili geldi; dilerseniz değiştirebilirsiniz.",
  "Geri",
  "Talep Oluştur",
  "Talebiniz seçtiğiniz alanın doktor havuzuna iletilir; doktorlar size yazılı teklif veya görüntülü görüşme randevusu sunar. Bu adımda ödeme veya rezervasyon yapılmaz.",
  "Talep oluşturulamadı, lütfen tekrar deneyin.",
  "Talebiniz alındı",
  "Talebiniz seçtiğiniz tedavi alanının doktor havuzuna iletildi. Doktorlar tekliflerini hazırladıkça iletişim tercihinizden bilgilendirileceksiniz.",
  "Anladım, Vakalarıma git",
  TOURISM_DISCLAIMER_TITLE,
  TOURISM_DISCLAIMER_BODY,
];

export function SaglikTurizmiPlanner() {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => [...TEXTS, ...CONTACT_PREF_TEXTS, ...PROFILE_STRIP_TEXTS, ...DICTATION_TEXTS, ...BRANCHES.map((b) => b.label)], []); // sabit referans — useT yarış dersi (v3.5)
  const { t } = useT(lang, texts);

  const [step, setStep] = useState<0 | 1>(0);
  const [patientName, setPatientName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]?.code ?? "TR");
  const [phone, setPhone] = useState(""); // FAZ 8 — hasta iletişim
  const [contactPref, setContactPref] = useState<ContactPref>("APP");
  const [symptoms, setSymptoms] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{ branchKey: string; branch: string; reasoning: string } | null>(null);
  const [branchKey, setBranchKey] = useState(""); // Tedavi Alanı seçimi — AI atadığı önceden seçili
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const analyzedForRef = useRef(""); // aynı semptomda tekrar LLM çağrısı yapma

  // Profil hafızası (Faz 1): ad/ülke/telefon/tercih prefill; profil yeterliyse kompakt şerit.
  const { profile } = usePatientProfile();
  const [editProfile, setEditProfile] = useState(false);
  const seededRef = useRef(false);
  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    if (profile.name) setPatientName(profile.name);
    if (profile.country && COUNTRIES.some((c) => c.code === profile.country)) setCountry(profile.country);
    if (profile.phone) setPhone(profile.phone);
    if (profile.contactPref) setContactPref(profile.contactPref);
  }, [profile]);
  const showStrip = profileComplete(profile, "full") && !editProfile;

  async function analyze() {
    if (!patientName.trim()) { setError(t("Lütfen hasta adını girin.")); return; }
    if (symptoms.trim().length < 8) { setError(t("Lütfen sağlık durumunuzu veya hedefinizi birkaç kelimeyle yazın.")); return; }
    setError("");
    // Semptom değişmediyse mevcut analizle ilerle (gereksiz LLM çağrısı yok)
    if (analysis && analyzedForRef.current === symptoms.trim()) { setStep(1); return; }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/triage/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms.trim() }),
      });
      if (!res.ok) throw new Error();
      const a = await res.json();
      setAnalysis({ branchKey: a.branchKey, branch: a.branch, reasoning: a.reasoning });
      setBranchKey(a.branchKey);
      analyzedForRef.current = symptoms.trim();
      setStep(1);
    } catch {
      setError(t("Analiz yapılamadı, lütfen tekrar deneyin."));
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitRequest() {
    setError(""); setSubmitting(true);
    // Öz-yeterli intake: seçilen branşta tourism-etiketli Case → branş doktor havuzu. Klinik-önce:
    // bağlayıcı fiyat/rezervasyon YOK; doktor görüşmesi + onayı sonrası mevcut teklif/escrow zinciri.
    try {
      const res = await fetch("/api/patient/tourism-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms.trim(), patientName: patientName.trim(), country, branchKey, patientPhone: phone, contactPreference: contactPref }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true); // AURA-dışı sorumluluk reddi onay ekranı (bildirim de sunucuda gönderildi)
    } catch {
      setError(t("Talep oluşturulamadı, lütfen tekrar deneyin."));
      setSubmitting(false);
    }
  }

  // Talep sonrası: hukuki uyarı onay ekranı (mesaj ayrıca bildirim olarak da gönderildi)
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--c-ink)]">{t("Talebiniz alındı")}</h1>
            <p className="text-sm text-[var(--c-ink-2)]">{t("Talebiniz seçtiğiniz tedavi alanının doktor havuzuna iletildi. Doktorlar tekliflerini hazırladıkça iletişim tercihinizden bilgilendirileceksiniz.")}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200 ring-1 ring-amber-400/25">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{t(TOURISM_DISCLAIMER_TITLE)}</div>
            <p className="mt-1.5 text-amber-200/90">{t(TOURISM_DISCLAIMER_BODY)}</p>
          </div>
        </div>

        <button type="button" onClick={() => window.location.assign("/vakalarim")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0c94a0]">
          {t("Anladım, Vakalarıma git")} <ArrowRight size={16} className="rtl:rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <JourneyIntakeShell icon={Plane} eyebrow={t("Sağlık Turizmi")} title={t("Sağlık Turizmini Planla")} intro={t("Tedavi hedefinizi ve tercihlerinizi paylaşın; kesin planı ve fiyatı görüşmede birlikte netleştirin.")} lang={lang} onLangChange={setLang}>

      {/* İki adımlı mini-gösterge (Branş Doktoru sihirbazına benzer) */}
      <div className="mt-6 flex items-center gap-2 text-xs">
        <SubStep n={1} label={t("Ön Bilgi")} active={step === 0} done={step > 0} />
        <span className="h-px w-6 bg-[var(--c-ink)]/15" />
        <SubStep n={2} label={t("Tedavi Alanı")} active={step === 1} done={false} />
      </div>

      <div className="mt-5 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
        {step === 0 ? (
          <div className="space-y-4">
            {showStrip && profile ? (
              <ProfileStrip profile={profile} fields="full" onEdit={() => setEditProfile(true)} t={t} />
            ) : (
              <>
                <Field label={t("Hasta Adı (veya yakını)")}>
                  <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder={t("Örn. Karim B.")} className="inp" />
                </Field>
                <Field label={t("Ülke")}>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className="inp">
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </Field>
                {/* FAZ 8 — telefon (opsiyonel) + "teklifler size hangi yoldan ulaşsın" */}
                <ContactPrefFields phone={phone} onPhone={setPhone} pref={contactPref} onPref={setContactPref} t={t} />
              </>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="block text-sm font-medium text-[var(--c-ink)]">{t("Sağlık durumunuz veya hedefiniz nedir?")}</span>
                <DictationButton lang={lang} onAppend={(txt) => setSymptoms((v) => (v.trim() ? v.trim() + " " : "") + txt)} t={t} />
              </div>
              <textarea value={symptoms} onChange={(e) => { setSymptoms(e.target.value); }} rows={4}
                placeholder={t("Örn. saç ekimi düşünüyorum; ön bölgede belirgin seyrekleşme var.")}
                className="inp resize-none" />
            </div>

            {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}

            <button type="button" onClick={analyze} disabled={analyzing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0c94a0] disabled:opacity-60">
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <>{t("Devam")} <ArrowRight size={16} className="rtl:rotate-180" /></>}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-xl bg-[var(--c-accent)]/10 p-3 text-xs leading-relaxed text-[#8fe6ef] ring-1 ring-[var(--c-accent)]/20">
              <Sparkles size={15} className="mt-0.5 shrink-0" />
              <span>{t("Verdiğiniz bilgilere göre önerilen tedavi alanı aşağıda seçili geldi; dilerseniz değiştirebilirsiniz.")}</span>
            </div>

            <Field label={t("Tedavi Alanı")}>
              <div className="flex flex-wrap gap-2">
                {BRANCHES.map((b) => (
                  <button key={b.key} type="button" onClick={() => setBranchKey(b.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${branchKey === b.key ? "border-[var(--c-accent-strong)] bg-[var(--c-accent)]/10 text-[var(--c-accent-strong)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-white/65 hover:border-[var(--c-hairline)]"}`}>
                    {t(b.label)}
                  </button>
                ))}
              </div>
            </Field>

            {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setError(""); setStep(0); }} disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-4 py-3 text-sm font-semibold text-[var(--c-ink-2)] transition hover:border-[var(--c-hairline)] hover:text-[var(--c-ink)] disabled:opacity-60">
                <ArrowLeft size={16} className="rtl:rotate-180" /> {t("Geri")}
              </button>
              <button type="button" onClick={submitRequest} disabled={submitting || !branchKey}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0c94a0] disabled:opacity-60">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <>{t("Talep Oluştur")} <ArrowRight size={16} className="rtl:rotate-180" /></>}
              </button>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-[var(--c-ink-3)]">{t("Talebiniz seçtiğiniz alanın doktor havuzuna iletilir; doktorlar size yazılı teklif veya görüntülü görüşme randevusu sunar. Bu adımda ödeme veya rezervasyon yapılmaz.")}</p>
          </div>
        )}
      </div>
    </JourneyIntakeShell>
  );
}

function SubStep({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : done ? "bg-[var(--c-accent)]/20 text-[var(--c-accent-stronger)]" : "bg-[var(--c-ink)]/10 text-white/40"}`}>{n}</span>
      <span className={active ? "font-semibold text-[var(--c-ink)]" : "text-[var(--c-ink-3)]"}>{label}</span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">{label}</label>
      {children}
    </div>
  );
}
