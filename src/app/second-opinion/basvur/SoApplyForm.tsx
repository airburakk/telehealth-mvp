"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PATIENT_BRANCHES } from "@/lib/triage";
import { SO_DURATION_COPY, SO_FEE_USD } from "@/lib/second-opinion";
import { secondOpinionDocSpecs, type SoDeliveryMethod } from "@/data/second-opinion-docs";
import { useT } from "@/components/useT";
import { useSoLang } from "@/components/SoLocale";
import { AiConsentGate } from "@/components/AiConsentGate";
import { JourneyIntakeShell } from "@/components/JourneyIntakeShell";
import { ContactPrefFields, CONTACT_PREF_TEXTS, type ContactPref } from "@/components/ContactPrefFields";
import { usePatientProfile, ProfileStrip, profileComplete, PROFILE_STRIP_TEXTS } from "@/components/ProfilePrefill";
import { DictationButton, DICTATION_TEXTS } from "@/components/DictationButton";
import { Stethoscope, Clock, Video, ArrowRight, Loader2, Globe, FileText, Link2, X, CreditCard, AlertTriangle, Sparkles } from "lucide-react";
import { COUNTRIES } from "@/lib/constants";

const D = SO_DURATION_COPY.tr;
const FEE_LINE = `Ücret: ${SO_FEE_USD} USD — peşin ve tek ödeme. Yazılı rapor ve video görüşme dahildir.`;
const MAX_FILE_CHARS = 12_000_000; // sunucu sınırıyla aynı (≈ 8.5 MB ham dosya)

// TR kanonik metinler — useT ile hedef dile çevrilir (cache + Claude). Türkçe'de aynen kalır.
const S = {
  eyebrow: "İkinci Görüş",
  title: "Ön Değerlendirme",
  intro: "Mevcut tanınıza ilişkin belgelerinizi yükleyin; alanında uzman bir doktor dosyanızı bağımsız olarak değerlendirsin. Süreç yazılı bir ikinci görüş ve ardından bir video görüşmeyle tamamlanır.",
  reportLabel: D.reportLabel,
  reportValue: D.reportValue,
  videoLabel: "Video görüşme",
  videoText: D.video,
  branchLabel: "İlgili tıbbi branş",
  branchPlaceholder: "Branş seçin…",
  // Branşı bilmeyen hasta için kapı (2026-07-31) — triyajdaki AI branş önerisi buraya bağlanır.
  askBranch: "İlgili tıbbi branşı biliyor musunuz?",
  knowYes: "Evet, biliyorum",
  knowNo: "Hayır, emin değilim",
  suggestIntro: "Durumunuzu aşağıya yazın; uygun tıbbi branşı birlikte belirleyelim.",
  suggestBtn: "Branşı belirle",
  suggestedLabel: "Önerilen branş",
  suggestNote: "Öneridir — doğru değilse değiştirebilirsiniz.",
  confidenceLabel: "Güven",
  errAnalyze: "Branş önerisi alınamadı. Aşağıdan kendiniz seçebilirsiniz.",
  countryLabel: "Ülkeniz",
  countryPlaceholder: "Ülke seçin…",
  langHint: "Yazılı görüş ve video görüşme bu dilde sağlanır.",
  diagLabel: "Mevcut tanınız / durumunuz",
  diagHint: "Konulan tanıyı, ne zaman ve nasıl tanı aldığınızı kısaca özetleyin.",
  diagPh: "Örn. 3 ay önce sol meme invaziv duktal karsinom tanısı kondu; cerrahi öneriliyor…",
  // Faz 3 — belgeler + ödeme aynı oturumda (hub'a ödenmiş inersiniz)
  docsTitle: "Belgeler",
  docsHint: "Branşınız için istenen belgeleri şimdi ekleyin; başvurunuz tek adımda incelemeye girsin.",
  fileBtn: "Dosya",
  linkBtn: "Bağlantı",
  add: "Ekle",
  urlPh: "https://… (DICOM / bulut bağlantısı)",
  imagingNote: "DICOM görüntüleme dosyaları büyüktür; bunları bulut/link olarak eklemeniz önerilir.",
  reqRequired: "Zorunlu",
  reqConditional: "Varsa",
  reqOptional: "Opsiyonel",
  missingLead: "Eksik zorunlu belge",
  willProvide: "Eksik zorunlu belgeleri sonra temin edeceğim.",
  payBtn: `Öde ve gönder (${SO_FEE_USD} USD)`,
  laterBtn: "Belgeleri sonra tamamla",
  paySim: "Ödeme simülasyondur — gerçek kart işlemi yapılmaz.",
  errLink: "Geçerli bir bağlantı (http/https) girin.",
  errBig: "Dosya 8 MB'tan büyük — lütfen bağlantı olarak ekleyin.",
  errGeneric: "Bir hata oluştu.",
} as const;

// Formda bekletilen belge — vaka oluşunca sırayla /documents API'sine gönderilir.
type PendingDoc = { type: string; deliveryMethod: SoDeliveryMethod; fileRef?: string; externalRef?: string; label: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Dosya okunamadı."));
    r.readAsDataURL(file);
  });
}

export function SoApplyForm() {
  // AI karşılama rıza kapısı — semptom/tanı girişinden ÖNCE. "Süreci Sonlandır" → hasta ana sekmesi.
  return (
    <AiConsentGate dest="/vakalarim">
      <SoApplyFormInner />
    </AiConsentGate>
  );
}

function SoApplyFormInner() {
  const router = useRouter();
  const [lang, setLang] = useSoLang();

  const [diagnosisSummary, setDiagnosisSummary] = useState("");
  const [branch, setBranch] = useState("");
  // Branş kapısı (2026-07-31): hasta branşı bilmiyorsa önce durumunu yazar, branşı AI önerir.
  // "" = henüz seçmedi (aşağıdaki alanlar açılmaz) · "yes" = kendi seçecek · "no" = öneri isteyecek.
  const [knowsBranch, setKnowsBranch] = useState<"" | "yes" | "no">("");
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<{ label: string; confidence: number } | null>(null);
  const [analyzeErr, setAnalyzeErr] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState(""); // FAZ 8 — hasta iletişim
  const [contactPref, setContactPref] = useState<ContactPref>("APP");
  const [submitting, setSubmitting] = useState<"" | "pay" | "later">("");
  const [error, setError] = useState("");

  // Faz 3 — tek oturumluk başvuru: belgeler + ödeme formda; hub'a ödenmiş inilir
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [linkOpen, setLinkOpen] = useState<string>(""); // bağlantı girişi açık olan belge tipi
  const [linkDraft, setLinkDraft] = useState("");
  const [willProvide, setWillProvide] = useState(false);
  const [docErr, setDocErr] = useState("");

  const specs = useMemo(() => (branch ? secondOpinionDocSpecs(branch) : []), [branch]);
  const attachedTypes = useMemo(() => new Set(docs.map((d) => d.type)), [docs]);
  const missingRequired = specs.filter((s) => s.requirement === "REQUIRED" && !attachedTypes.has(s.type));

  // Profil hafızası (Faz 1): prefill + kompakt şerit; dil TEK kaynak air_lang (sağ üst seçici) —
  // ülke önerisi yalnız hasta dili hiç açıkça seçmemişse (langLocked).
  const { profile } = usePatientProfile();
  const [editProfile, setEditProfile] = useState(false);
  const [langLocked, setLangLocked] = useState(false);
  const seededRef = useRef(false);
  useEffect(() => {
    try { if (localStorage.getItem("air_lang")) setLangLocked(true); } catch {}
  }, []);
  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    if (profile.country) setCountry(profile.country);
    if (profile.phone) setPhone(profile.phone);
    if (profile.contactPref) setContactPref(profile.contactPref);
    try { if (!localStorage.getItem("air_lang") && profile.language) setLang(profile.language); } catch {}
  }, [profile, setLang]);
  function chooseLang(l: string) { setLangLocked(true); setLang(l); }
  const showStrip = profileComplete(profile, "full") && !editProfile;

  const texts = useMemo(
    () => [...Object.values(S), FEE_LINE, ...CONTACT_PREF_TEXTS, ...PROFILE_STRIP_TEXTS, ...DICTATION_TEXTS, ...PATIENT_BRANCHES.map((b) => b.label), ...COUNTRIES.map((c) => c.name), ...specs.map((s) => s.label)],
    [specs],
  );
  const { t } = useT(lang, texts);

  function onCountry(code: string) {
    setCountry(code);
    const c = COUNTRIES.find((x) => x.code === code);
    if (c && c.langs[0] && !langLocked) setLang(c.langs[0]); // dil TEK kaynak (air_lang); açık seçim ezilmez
  }

  async function attachFile(type: string, file: File) {
    setDocErr("");
    try {
      const data = await fileToDataUrl(file);
      if (data.length > MAX_FILE_CHARS) return setDocErr(t(S.errBig));
      setDocs((prev) => [...prev.filter((d) => d.type !== type), { type, deliveryMethod: "FILE_UPLOAD", fileRef: data, label: file.name }]);
    } catch {
      setDocErr(t(S.errGeneric));
    }
  }

  // Branş önerisi — triyajın MEVCUT ucunu kullanır (yeni AI hattı yok): /api/triage/analyze
  // oturum korumalıdır ve ANTHROPIC_API_KEY yoksa/LLM zaman aşımına uğrarsa kural motoruna düşer
  // (lib/triage-llm.runTriage) ⇒ her koşulda bir branş döner, akış AI'a bağımlı DEĞİLDİR.
  // Hastaya yalnız branş + güven gösterilir; aciliyet/gerekçe hasta yüzünde GİZLİ (2026-07-13 kararı).
  // Not: tanı metni klinik içeriktir → çeviri cache'ine (useT) verilmez, yalnız bu uca gider.
  async function suggestBranch() {
    if (diagnosisSummary.trim().length < 10) return;
    setAnalyzing(true);
    setAnalyzeErr("");
    try {
      const res = await fetch("/api/triage/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: diagnosisSummary }),
      });
      const d = await res.json();
      if (!res.ok || !d?.branchKey) throw new Error("no-branch");
      setBranch(d.branchKey); // PATIENT_BRANCHES[].key — SO API'si de key doğrular (route.ts:48)
      setSuggestion({ label: String(d.branch ?? ""), confidence: Number(d.confidence ?? 0) });
    } catch {
      // Fail-open: öneri alınamazsa hasta branşı kendisi seçebilsin (select yine görünür).
      setAnalyzeErr(t(S.errAnalyze));
      setSuggestion(null);
    }
    setAnalyzing(false);
  }

  function attachLink(type: string) {
    setDocErr("");
    const url = linkDraft.trim();
    if (!/^https?:\/\/.+/i.test(url)) return setDocErr(t(S.errLink));
    setDocs((prev) => [...prev.filter((d) => d.type !== type), { type, deliveryMethod: "EXTERNAL_LINK", externalRef: url, label: url }]);
    setLinkOpen("");
    setLinkDraft("");
  }

  // KVKK açık onam girişte bir kez alınır (/onam) → başvuruda tekrar onam kutusu yok.
  const canSubmit = diagnosisSummary.trim().length >= 10 && branch && country && !submitting;
  const canPayNow = canSubmit && (missingRequired.length === 0 || willProvide);

  // Tek oturumluk başvuru (Faz 3): vaka oluştur → bekletilen belgeleri yükle → (payNow) öde → hub.
  // Ara adım hata verirse yine hub'a inilir — hub DRAFT durumunda kalan adımları kendisi sunar.
  async function submit(payNow: boolean) {
    setError("");
    setSubmitting(payNow ? "pay" : "later");
    let caseId = "";
    try {
      const res = await fetch("/api/second-opinion/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, diagnosisSummary, branch, country, language: lang, patientPhone: phone, contactPreference: contactPref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || S.errGeneric);
      caseId = data.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : t(S.errGeneric));
      setSubmitting("");
      return;
    }
    try {
      for (const d of docs) {
        await fetch(`/api/second-opinion/cases/${caseId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d),
        });
      }
      if (payNow) {
        await fetch(`/api/second-opinion/cases/${caseId}/pay`, { method: "POST" });
      }
    } catch {
      /* vaka oluştu — kalan adımlar hub'da (DRAFT kurtarma yolu) */
    }
    router.push(`/second-opinion/vaka/${caseId}`);
  }

  // Tanı/durum alanı İKİ konumda görünebilir: "branşı bilmiyorum" dalında branş kapısının içinde
  // (önce yazılır, sonra öneri alınır), "biliyorum" dalında ise formun kendi sırasında. Aynı state,
  // tek JSX → kopya alan/çift id olmaz (aynı anda yalnız biri render edilir).
  const diagnosisField = (
    <>
      <div className="mt-5 flex items-center justify-between gap-2">
        <label htmlFor="so-diagnosis" className="block text-sm font-semibold text-[var(--c-ink)]">{t(S.diagLabel)}</label>
        <DictationButton lang={lang} onAppend={(txt) => setDiagnosisSummary((v) => (v.trim() ? v.trim() + " " : "") + txt)} t={t} />
      </div>
      <p className="text-xs text-[var(--c-ink-2)]">{t(S.diagHint)}</p>
      <textarea
        id="so-diagnosis"
        value={diagnosisSummary}
        onChange={(e) => setDiagnosisSummary(e.target.value)}
        rows={5}
        placeholder={t(S.diagPh)}
        className="mt-1.5 w-full resize-y rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2.5 text-sm text-[var(--c-ink)] focus:border-[var(--c-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/30"
      />
    </>
  );

  return (
    <JourneyIntakeShell icon={Stethoscope} eyebrow={t(S.eyebrow)} title={t(S.title)} intro={t(S.intro)} lang={lang} onLangChange={chooseLang} journey="SECOND_OPINION" stage={0}>

      {/* §12.2 — süre bilgilendirmesi (tek kaynak: lib/second-opinion; useT ile çok dilli) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4">
          <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
            <Clock size={14} /> {t(S.reportLabel)}
          </div>
          <div className="mt-1 text-2xl font-bold text-[var(--c-ink)]">{t(S.reportValue)}</div>
        </div>
        <div className="rounded-2xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/[0.06] p-4">
          <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-accent-stronger)]">
            <Video size={14} /> {t(S.videoLabel)}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{t(S.videoText)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3 text-sm text-[var(--c-ink-2)]">{t(FEE_LINE)}</div>

      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
        {/* Branş kapısı — hasta branşı biliyorsa doğrudan seçer; bilmiyorsa önce durumunu yazar,
            branşı AI önerir (triyaj deseni). Kapı seçilmeden branş alanı açılmaz. */}
        <fieldset>
          <legend className="block text-sm font-semibold text-[var(--c-ink)]">{t(S.askBranch)}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([["yes", S.knowYes], ["no", S.knowNo]] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                aria-pressed={knowsBranch === val}
                onClick={() => { setKnowsBranch(val); setAnalyzeErr(""); if (val === "no") { setBranch(""); setSuggestion(null); } }}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  knowsBranch === val
                    ? "border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-ink)]"
                    : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40"
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* "Bilmiyorum" → durum metni burada (yukarıda), ardından öneri butonu + sonuç */}
        {knowsBranch === "no" && (
          <div className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
            <p className="text-xs text-[var(--c-ink-2)]">{t(S.suggestIntro)}</p>
            {diagnosisField}
            <button
              type="button"
              onClick={suggestBranch}
              disabled={analyzing || diagnosisSummary.trim().length < 10}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t(S.suggestBtn)}
            </button>
            {analyzeErr && <p className="mt-2 text-sm text-red-300">{analyzeErr}</p>}
          </div>
        )}

        {/* Branş seçimi: "biliyorum"da doğrudan; "bilmiyorum"da öneri geldikten SONRA (düzeltilebilir) */}
        {(knowsBranch === "yes" || (knowsBranch === "no" && (branch || analyzeErr))) && (
          <div className="mt-5">
            {suggestion && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 px-3 py-2">
                <span className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-accent)]">{t(S.suggestedLabel)}</span>
                <span className="rounded-lg bg-[var(--c-surface)] px-2.5 py-1 text-sm font-semibold text-[var(--c-ink)] ring-1 ring-[var(--c-hairline)]">{t(suggestion.label)}</span>
                <span className="text-xs text-[var(--c-ink-2)]">{t(S.confidenceLabel)} %{suggestion.confidence}</span>
                <span className="w-full text-xs text-[var(--c-ink-2)]">{t(S.suggestNote)}</span>
              </div>
            )}
            <label htmlFor="so-branch" className="block text-sm font-semibold text-[var(--c-ink)]">{t(S.branchLabel)}</label>
            <select
              id="so-branch"
              value={branch}
              onChange={(e) => { setBranch(e.target.value); setSuggestion(null); }}
              className="mt-1.5 w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2.5 text-sm text-[var(--c-ink)] focus:border-[var(--c-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/30"
            >
              <option value="">{t(S.branchPlaceholder)}</option>
              {PATIENT_BRANCHES.map((b) => (
                <option key={b.key} value={b.key}>{t(b.label)}</option>
              ))}
            </select>
          </div>
        )}

        {showStrip && profile ? (
          // Profil dolu → ülke + iletişim alanları yerine kompakt şerit (Faz 1)
          <div className="mt-5">
            <ProfileStrip profile={profile} fields="full" onEdit={() => setEditProfile(true)} t={t} />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <label htmlFor="so-country" className="block text-sm font-semibold text-[var(--c-ink)]">{t(S.countryLabel)}</label>
              <select
                id="so-country"
                value={country}
                onChange={(e) => onCountry(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2.5 text-sm text-[var(--c-ink)] focus:border-[var(--c-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]/30"
              >
                <option value="">{t(S.countryPlaceholder)}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {t(c.name)}</option>
                ))}
              </select>
            </div>

            {/* FAZ 8 — telefon + iletişim tercihi (4 senaryonun ortak Ön Bilgi alanı) */}
            <div className="mt-5">
              <ContactPrefFields phone={phone} onPhone={setPhone} pref={contactPref} onPref={setContactPref} t={t} />
            </div>
          </>
        )}

        {/* Dil TEK kaynak: sağ üst seçici (air_lang). Yazılı görüş + video bu dilde sağlanır. */}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--c-ink-2)]">
          <Globe size={13} className="text-[var(--c-accent)]" /> {lang} · {t(S.langHint)}
        </p>

        {/* "Biliyorum" dalında tanı alanı kendi sırasında; "bilmiyorum" dalında yukarıda gösterildi. */}
        {knowsBranch !== "no" && diagnosisField}

        {/* Faz 3 — Belgeler formda (branş seçilince): tip tip ekle; başvuru tek oturumda incelemeye girer */}
        {specs.length > 0 && (
          <div className="mt-6">
            <div className="text-sm font-semibold text-[var(--c-ink)]">{t(S.docsTitle)}</div>
            <p className="text-xs text-[var(--c-ink-2)]">{t(S.docsHint)}</p>
            <ul className="mt-2.5 space-y-2">
              {specs.map((sp) => {
                const attached = docs.find((d) => d.type === sp.type);
                const badge = sp.requirement === "REQUIRED" ? { l: S.reqRequired, cls: "bg-red-500/10 text-red-300 ring-red-400/25" }
                  : sp.requirement === "CONDITIONAL" ? { l: S.reqConditional, cls: "bg-amber-500/10 text-amber-300 ring-amber-400/25" }
                  : { l: S.reqOptional, cls: "bg-[var(--c-ink)]/10 text-[var(--c-ink-2)] ring-white/10" };
                return (
                  <li key={sp.type} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[var(--c-ink)]">{t(sp.label)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.cls}`}>{t(badge.l)}</span>
                      {attached ? (
                        <span className="ms-auto inline-flex min-w-0 items-center gap-1.5 text-xs text-[var(--c-accent)]">
                          {attached.deliveryMethod === "FILE_UPLOAD" ? <FileText size={13} /> : <Link2 size={13} />}
                          <span className="max-w-[180px] truncate" dir="ltr">{attached.label}</span>
                          <button type="button" onClick={() => setDocs((p) => p.filter((d) => d.type !== sp.type))} className="text-[var(--c-ink-3)] hover:text-red-400"><X size={14} /></button>
                        </span>
                      ) : (
                        <span className="ms-auto flex items-center gap-1.5">
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40">
                            <FileText size={12} /> {t(S.fileBtn)}
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attachFile(sp.type, f); }} />
                          </label>
                          <button type="button" onClick={() => { setLinkOpen(linkOpen === sp.type ? "" : sp.type); setLinkDraft(""); }} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40">
                            <Link2 size={12} /> {t(S.linkBtn)}
                          </button>
                        </span>
                      )}
                    </div>
                    {linkOpen === sp.type && !attached && (
                      <div className="mt-2 flex items-center gap-2">
                        <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} placeholder={t(S.urlPh)} dir="ltr" className="w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-ink)] focus:border-[var(--c-accent)] focus:outline-none" />
                        <button type="button" onClick={() => attachLink(sp.type)} className="shrink-0 rounded-lg bg-[var(--c-accent)] px-3 py-2 text-xs font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">{t(S.add)}</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-[var(--c-ink-3)]">{t(S.imagingNote)}</p>

            {missingRequired.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-200 ring-1 ring-amber-400/25">
                <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {t(S.missingLead)}: {missingRequired.map((m) => t(m.label)).join(", ")}</div>
                <label className="mt-2 flex items-start gap-2 font-medium">
                  <input type="checkbox" checked={willProvide} onChange={(e) => setWillProvide(e.target.checked)} className="mt-0.5 accent-amber-600" />
                  <span>{t(S.willProvide)}</span>
                </label>
              </div>
            )}
          </div>
        )}

        {(error || docErr) && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error || docErr}</p>}

        {/* Faz 3 — tek oturum: Öde ve gönder (varsayılan) · Belgeleri sonra tamamla (DRAFT çıkışı) */}
        <button
          onClick={() => submit(true)}
          disabled={!canPayNow}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-6 py-3 text-[15px] font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "pay" ? <Loader2 size={17} className="animate-spin" /> : <><CreditCard size={17} /> {t(S.payBtn)}</>}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-[var(--c-ink-3)]">{t(S.paySim)}</p>
        <button
          onClick={() => submit(false)}
          disabled={!canSubmit}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-6 py-2.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "later" ? <Loader2 size={16} className="animate-spin" /> : <>{t(S.laterBtn)} <ArrowRight size={16} /></>}
        </button>
      </div>
    </JourneyIntakeShell>
  );
}
