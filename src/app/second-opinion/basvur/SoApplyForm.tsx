"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES } from "@/lib/triage";
import { SO_DURATION_COPY, SO_FEE_USD } from "@/lib/second-opinion";
import { useT } from "@/components/useT";
import { useSoLang } from "@/components/SoLocale";
import { JourneyIntakeShell } from "@/components/JourneyIntakeShell";
import { ContactPrefFields, CONTACT_PREF_TEXTS, type ContactPref } from "@/components/ContactPrefFields";
import { usePatientProfile, ProfileStrip, profileComplete, PROFILE_STRIP_TEXTS } from "@/components/ProfilePrefill";
import { Stethoscope, Clock, Video, ArrowRight, Loader2, Globe } from "lucide-react";
import { COUNTRIES } from "@/lib/constants";

const D = SO_DURATION_COPY.tr;
const FEE_LINE = `Ücret: ${SO_FEE_USD} USD — peşin ve tek ödeme. Yazılı rapor ve video görüşme dahildir.`;
// TR kanonik metinler — useT ile hedef dile çevrilir (cache + Claude). Türkçe'de aynen kalır.
const S = {
  eyebrow: "İkinci Görüş",
  title: "Second Opinion Ön Değerlendirme",
  intro: "Mevcut tanınıza ilişkin belgelerinizi yükleyin; alanında uzman bir doktor dosyanızı bağımsız olarak değerlendirsin. Süreç yazılı bir ikinci görüş ve ardından bir video görüşmeyle tamamlanır.",
  reportLabel: D.reportLabel,
  reportValue: D.reportValue,
  videoLabel: "Video görüşme",
  videoText: D.video,
  branchLabel: "İlgili tıbbi branş",
  branchPlaceholder: "Branş seçin…",
  countryLabel: "Ülkeniz",
  countryPlaceholder: "Ülke seçin…",
  langLabel: "Tercih ettiğiniz iletişim dili",
  langHint: "Yazılı görüş ve video görüşme bu dilde sağlanır.",
  diagLabel: "Mevcut tanınız / durumunuz",
  diagHint: "Konulan tanıyı, ne zaman ve nasıl tanı aldığınızı kısaca özetleyin.",
  diagPh: "Örn. 3 ay önce sol meme invaziv duktal karsinom tanısı kondu; cerrahi öneriliyor…",
  submit: "Devam et — belge yükleme",
  errGeneric: "Bir hata oluştu.",
} as const;

export function SoApplyForm() {
  const router = useRouter();
  const [lang, setLang] = useSoLang();
  const texts = useMemo(() => [...Object.values(S), FEE_LINE, ...CONTACT_PREF_TEXTS, ...PROFILE_STRIP_TEXTS, ...BRANCHES.map((b) => b.label), ...COUNTRIES.map((c) => c.name)], []);
  const { t } = useT(lang, texts);

  const [diagnosisSummary, setDiagnosisSummary] = useState("");
  const [branch, setBranch] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState(""); // FAZ 8 — hasta iletişim
  const [contactPref, setContactPref] = useState<ContactPref>("APP");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  function onCountry(code: string) {
    setCountry(code);
    const c = COUNTRIES.find((x) => x.code === code);
    if (c && c.langs[0] && !langLocked) setLang(c.langs[0]); // dil TEK kaynak (air_lang); açık seçim ezilmez
  }

  // KVKK açık onam girişte bir kez alınır (/onam) → başvuruda tekrar onam kutusu yok.
  const canSubmit = diagnosisSummary.trim().length >= 10 && branch && country && !submitting;

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/second-opinion/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, diagnosisSummary, branch, country, language: lang, patientPhone: phone, contactPreference: contactPref }),
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
    <JourneyIntakeShell icon={Stethoscope} eyebrow={t(S.eyebrow)} title={t(S.title)} intro={t(S.intro)} lang={lang} onLangChange={chooseLang} journey="SECOND_OPINION" stage={1}>

      {/* §12.2 — süre bilgilendirmesi (tek kaynak: lib/second-opinion; useT ile çok dilli) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#161719] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
            <Clock size={14} /> {t(S.reportLabel)}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#F4F5F3]">{t(S.reportValue)}</div>
        </div>
        <div className="rounded-2xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.06] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#17919E]">
            <Video size={14} /> {t(S.videoLabel)}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-white/65">{t(S.videoText)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#1E1F22] px-4 py-3 text-sm text-white/65">{t(FEE_LINE)}</div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <label className="block text-sm font-semibold text-white/75">{t(S.branchLabel)}</label>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#161719] px-3 py-2.5 text-sm text-[#F4F5F3] focus:border-[#28C8D8] focus:outline-none focus:ring-2 focus:ring-[#28C8D8]/30"
        >
          <option value="">{t(S.branchPlaceholder)}</option>
          {BRANCHES.map((b) => (
            <option key={b.key} value={b.key}>{t(b.label)}</option>
          ))}
        </select>

        {showStrip && profile ? (
          // Profil dolu → ülke + iletişim alanları yerine kompakt şerit (Faz 1)
          <div className="mt-5">
            <ProfileStrip profile={profile} fields="full" onEdit={() => setEditProfile(true)} t={t} />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <label className="block text-sm font-semibold text-white/75">{t(S.countryLabel)}</label>
              <select
                value={country}
                onChange={(e) => onCountry(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#161719] px-3 py-2.5 text-sm text-[#F4F5F3] focus:border-[#28C8D8] focus:outline-none focus:ring-2 focus:ring-[#28C8D8]/30"
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
        <p className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
          <Globe size={13} className="text-[#28C8D8]" /> {lang} · {t(S.langHint)}
        </p>

        <label className="mt-5 block text-sm font-semibold text-white/75">{t(S.diagLabel)}</label>
        <p className="text-xs text-white/50">{t(S.diagHint)}</p>
        <textarea
          value={diagnosisSummary}
          onChange={(e) => setDiagnosisSummary(e.target.value)}
          rows={5}
          placeholder={t(S.diagPh)}
          className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-[#161719] px-3 py-2.5 text-sm text-[#F4F5F3] focus:border-[#28C8D8] focus:outline-none focus:ring-2 focus:ring-[#28C8D8]/30"
        />

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 size={17} className="animate-spin" /> : <>{t(S.submit)} <ArrowRight size={17} /></>}
        </button>
      </div>
    </JourneyIntakeShell>
  );
}
