"use client";

// Sağlık Turizmi hasta-yüzü planlayıcı (Faz 1) — tercih + ENDİKATİF önizleme (bağlayıcı DEĞİL).
// Fiyat motoru lib/pricing.ts (doktor-yüzü PackageBuilder ile AYNI); önizlemede doktor işlemi yok →
// branş taban fiyatı kullanılır. Kesin fiyat = doktor değerlendirmesi sonrası (klinik-önce; disclaimer zorunlu).
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, Hotel, Stethoscope, ClipboardList, ShieldCheck, Sparkles, ArrowRight, Info, Loader2 } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang } from "@/components/PatientLocale";
import { JourneyIntakeShell } from "@/components/JourneyIntakeShell";
import { ContactPrefFields, CONTACT_PREF_TEXTS, type ContactPref } from "@/components/ContactPrefFields";
import { usePatientProfile, ProfileStrip, profileComplete, PROFILE_STRIP_TEXTS } from "@/components/ProfilePrefill";
import { countryFlag, countryName } from "@/lib/constants";
import { computePackage, formatUSD, TIER_PRESETS, type PackageSelection, type Tier } from "@/lib/pricing";

// Turizm-ilgili branşlar (lib/pricing.ts TREATMENT_BASE anahtarlarıyla eşleşir → gerçek taban fiyat).
const BRANCHES = ["Saç Ekimi", "Diş", "Estetik", "Göz", "Tüp Bebek", "Ortopedi", "Kardiyoloji", "Onkoloji", "Genel Cerrahi", "Nöroşirürji", "Dahiliye"];
// Kaynak ülkeler (lib/pricing.ts FLIGHT_BY_COUNTRY ile hizalı).
const COUNTRIES = ["DZ", "LY", "RU", "AZ", "KZ", "KG", "TR"];
const TIERS: Tier[] = ["Ekonomik", "Standart", "Premium"];
const NIGHT_OPTIONS = [3, 5, 7, 10, 14];

const TEXTS = [
  "Sağlık Turizmi",
  "Sağlık Turizmini Planla",
  "Tedavi, seyahat ve konaklamayı tek yerden tahmini olarak planlayın; kesin planı doktorunuzla birlikte netleştirin.",
  "Tedavi alanı",
  "Nereden geliyorsunuz?",
  "Paket seviyesi",
  "Konaklama süresi",
  "gece",
  "Tahmini paket özeti",
  "Tedavi",
  "Seyahat & Konaklama",
  "Sigorta",
  "Platform hizmet bedeli",
  "Tahmini toplam",
  "Bu bir tahmini (endikatif) fiyattır — kesin fiyat, doktor değerlendirmesi ve tıbbi planınız netleştikten sonra belirlenir. Ödeme ve rezervasyon bu adımda yapılmaz.",
  "Talep Oluştur",
  "Talebiniz doktora iletilir; görüşmede tıbbi durumunuz değerlendirilip kesin plan ve fiyat oluşturulur. Bu adımda ödeme veya rezervasyon yapılmaz.",
  "Sağlık durumunuz veya hedefiniz nedir?",
  "Örn. saç ekimi düşünüyorum; ön bölgede belirgin seyrekleşme var.",
  "Lütfen sağlık durumunuzu veya hedefinizi birkaç kelimeyle yazın.",
  "Talep oluşturulamadı, lütfen tekrar deneyin.",
  "Ekonomik",
  "Standart",
  "Premium",
  "Neler dahil?",
  "Tıbbi tedavi",
  "Otel + uçuş + transfer",
  "Zorunlu sağlık turizmi sigortası",
  "Tıbbi tercüman (Premium)",
];

const TIER_LABEL: Record<Tier, string> = { Ekonomik: "Ekonomik", Standart: "Standart", Premium: "Premium" };

export function SaglikTurizmiPlanner({ rate }: { rate: number }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => [...TEXTS, ...CONTACT_PREF_TEXTS, ...PROFILE_STRIP_TEXTS], []); // sabit referans — useT yarış dersi (v3.5)
  const { t } = useT(lang, texts);

  const [branch, setBranch] = useState(BRANCHES[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [tier, setTier] = useState<Tier>("Standart");
  const [nights, setNights] = useState(7);
  const [symptoms, setSymptoms] = useState("");
  const [phone, setPhone] = useState(""); // FAZ 8 — hasta iletişim
  const [contactPref, setContactPref] = useState<ContactPref>("APP");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Profil hafızası (Faz 1): telefon/tercih (+ listedeyse ülke) prefill; iletişim kutusu yerine şerit.
  const { profile } = usePatientProfile();
  const [editProfile, setEditProfile] = useState(false);
  const seededRef = useRef(false);
  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    if (profile.country && COUNTRIES.includes(profile.country)) setCountry(profile.country);
    if (profile.phone) setPhone(profile.phone);
    if (profile.contactPref) setContactPref(profile.contactPref);
  }, [profile]);
  const showStrip = profileComplete(profile, "contact") && !editProfile;

  const quote = useMemo(() => {
    const p = TIER_PRESETS[tier];
    const selection: PackageSelection = {
      branch, country, tier,
      hotelStars: (p.hotelStars ?? 4) as 4 | 5,
      hospitalType: p.hospitalType ?? "Özel",
      nights,
      translator: p.translator ?? false,
      insuranceLevel: p.insuranceLevel,
      insuranceExtended: p.insuranceExtended ?? false,
      insuranceMalpractice: p.insuranceMalpractice ?? false,
    };
    return computePackage(selection, undefined, rate); // doktor işlemi YOK → branş taban fiyatı
  }, [branch, country, tier, nights, rate]);

  // Kategori-düzeyi döküm (iç split değil — güven + sadelik; tasarım kararı).
  const cats = useMemo(() => {
    const sum = (keys: string[]) => quote.items.filter((i) => keys.includes(i.key) || (i.key.startsWith("tx-") && keys.includes("treatment"))).reduce((a, b) => a + b.amount, 0);
    return {
      tedavi: sum(["treatment"]),
      seyahat: sum(["hotel", "flight", "transfer", "translator"]),
      sigorta: sum(["insurance"]),
      platform: quote.platformFee,
    };
  }, [quote]);

  async function submitRequest() {
    if (symptoms.trim().length < 8) { setError(t("Lütfen sağlık durumunuzu veya hedefinizi birkaç kelimeyle yazın.")); return; }
    setError(""); setBusy(true);
    // Öz-yeterli intake: tourism-etiketli Case oluştur (tercihler + şikayet) → doktor kuyruğu. Klinik-önce:
    // bağlayıcı fiyat/rezervasyon YOK; doktor görüşmesi + onayı sonrası mevcut teklif/escrow zinciri.
    try {
      const res = await fetch("/api/patient/tourism-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: symptoms.trim(), tier, nights, country, branch, patientPhone: phone, contactPreference: contactPref }),
      });
      if (!res.ok) throw new Error();
      window.location.assign("/vakalarim"); // tam sayfa: nav taze + yeni talep listede görünür
    } catch {
      setError(t("Talep oluşturulamadı, lütfen tekrar deneyin."));
      setBusy(false);
    }
  }

  return (
    <JourneyIntakeShell icon={Plane} eyebrow={t("Sağlık Turizmi")} title={t("Sağlık Turizmini Planla")} intro={t("Tedavi, seyahat ve konaklamayı tek yerden tahmini olarak planlayın; kesin planı doktorunuzla birlikte netleştirin.")} lang={lang} onLangChange={setLang} wide journey="HEALTH_TOURISM" stage={1}>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Sol: tercih formu */}
        <div className="space-y-5">
          <Field icon={<ClipboardList size={15} />} label={t("Sağlık durumunuz veya hedefiniz nedir?")}>
            <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={3}
              placeholder={t("Örn. saç ekimi düşünüyorum; ön bölgede belirgin seyrekleşme var.")}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#161719] px-3 py-2 text-sm text-white/75 outline-none placeholder:text-white/40 focus:border-[#1FA9B8]" />
          </Field>

          <Field icon={<Stethoscope size={15} />} label={t("Tedavi alanı")}>
            <div className="flex flex-wrap gap-2">
              {BRANCHES.map((b) => (
                <Chip key={b} active={branch === b} onClick={() => setBranch(b)}>{b}</Chip>
              ))}
            </div>
          </Field>

          {/* FAZ 8 — telefon + iletişim tercihi; profil doluysa kompakt şerit (Faz 1) */}
          {showStrip && profile ? (
            <ProfileStrip profile={profile} fields="contact" onEdit={() => setEditProfile(true)} t={t} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#161719] p-4">
              <ContactPrefFields phone={phone} onPhone={setPhone} pref={contactPref} onPref={setContactPref} t={t} />
            </div>
          )}

          <Field icon={<Plane size={15} />} label={t("Nereden geliyorsunuz?")}>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map((c) => (
                <Chip key={c} active={country === c} onClick={() => setCountry(c)}>{countryFlag(c)} {countryName(c)}</Chip>
              ))}
            </div>
          </Field>

          <Field icon={<Sparkles size={15} />} label={t("Paket seviyesi")}>
            <div className="grid grid-cols-3 gap-2">
              {TIERS.map((ti) => (
                <button key={ti} type="button" onClick={() => setTier(ti)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${tier === ti ? "border-[#1FA9B8] bg-[#28C8D8]/10 text-[#1FA9B8]" : "border-white/10 bg-[#161719] text-white/65 hover:border-white/15"}`}>
                  {t(TIER_LABEL[ti])}
                </button>
              ))}
            </div>
          </Field>

          <Field icon={<Hotel size={15} />} label={t("Konaklama süresi")}>
            <div className="flex flex-wrap gap-2">
              {NIGHT_OPTIONS.map((n) => (
                <Chip key={n} active={nights === n} onClick={() => setNights(n)}>{n} {t("gece")}</Chip>
              ))}
            </div>
          </Field>

          <div className="rounded-2xl border border-white/10 bg-[#161719] p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><ShieldCheck size={14} /> {t("Neler dahil?")}</div>
            <ul className="mt-2 grid gap-1.5 text-sm text-white/65 sm:grid-cols-2">
              <li className="flex items-center gap-1.5"><Stethoscope size={14} className="text-[#1FA9B8]" /> {t("Tıbbi tedavi")}</li>
              <li className="flex items-center gap-1.5"><Plane size={14} className="text-[#1FA9B8]" /> {t("Otel + uçuş + transfer")}</li>
              <li className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#1FA9B8]" /> {t("Zorunlu sağlık turizmi sigortası")}</li>
              {tier === "Premium" && <li className="flex items-center gap-1.5"><Sparkles size={14} className="text-[#1FA9B8]" /> {t("Tıbbi tercüman (Premium)")}</li>}
            </ul>
          </div>
        </div>

        {/* Sağ: tahmini özet (sticky) */}
        <aside className="lg:sticky lg:top-6 h-fit space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/40">{t("Tahmini paket özeti")}</div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label={t("Tedavi")} value={formatUSD(cats.tedavi)} />
              <Row label={t("Seyahat & Konaklama")} value={formatUSD(cats.seyahat)} />
              <Row label={t("Sigorta")} value={formatUSD(cats.sigorta)} />
              <Row label={t("Platform hizmet bedeli")} value={formatUSD(cats.platform)} />
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-semibold text-white/75">{t("Tahmini toplam")}</span>
              <span className="font-serif text-2xl font-bold text-[#1FA9B8]">{formatUSD(quote.total)}</span>
            </div>

            <div className="mt-4 flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200 ring-1 ring-amber-400/25">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>{t("Bu bir tahmini (endikatif) fiyattır — kesin fiyat, doktor değerlendirmesi ve tıbbi planınız netleştikten sonra belirlenir. Ödeme ve rezervasyon bu adımda yapılmaz.")}</span>
            </div>

            {error && <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}

            <button type="button" onClick={submitRequest} disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1FA9B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0c94a0] disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{t("Talep Oluştur")} <ArrowRight size={16} className="rtl:rotate-180" /></>}
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-white/40">{t("Talebiniz doktora iletilir; görüşmede tıbbi durumunuz değerlendirilip kesin plan ve fiyat oluşturulur. Bu adımda ödeme veya rezervasyon yapılmaz.")}</p>
          </div>
        </aside>
      </div>
    </JourneyIntakeShell>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161719] p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">{icon} {label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? "border-[#1FA9B8] bg-[#28C8D8]/10 text-[#1FA9B8]" : "border-white/10 bg-[#161719] text-white/65 hover:border-white/15"}`}>
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-white/50">{label}</dt>
      <dd className="font-medium text-[#F4F5F3]">{value}</dd>
    </div>
  );
}
