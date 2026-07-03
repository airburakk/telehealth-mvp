"use client";

// "Nasıl İlerlemek İstersiniz?" seçim kartları — hasta girişinin ilk ekranı.
// Seçim POST /api/patient/journey ile kalıcı yazılır, sonra ilgili akışa tam-sayfa yönlendirilir.
// Sağlık Turizmi kartı bilinçli "Yakında" (tasarımı ayrı iş — vault todo). Çok dilli: usePatientLang+useT.
import { useMemo, useState } from "react";
import { Loader2, Stethoscope, FileSearch, Plane, HeartHandshake, ArrowRight } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";

const TEXTS = [
  "Nasıl ilerlemek istersiniz?",
  "Hoş geldiniz",
  "Size uygun yolu seçin — seçiminizi daha sonra değiştirebilirsiniz.",
  "Branş Doktoru İle Görüş",
  "Şikayetinizi anlatın; yapay zekâ destekli ön değerlendirmeyle uygun branş doktoruna bağlanın.",
  "İkinci Görüş Al",
  "Mevcut tanı ve tedavi planınız için bağımsız uzmandan yazılı rapor + video görüşme alın.",
  "Sağlık Turizmini Doktorunla Planla",
  "Tedavi, seyahat ve konaklamayı doktorunuzla birlikte uçtan uca planlayın.",
  "Yakında",
  "Ücretsiz Sağlık Hizmeti İçin Başvur",
  "Maddi imkânı kısıtlı hastalar için gönüllü doktorlarla ücretsiz video konsültasyon.",
  "Mevcut seçiminiz",
  "İşlem yapılamadı, lütfen tekrar deneyin.",
];

type JourneyKey = "GENERAL" | "SECOND_OPINION" | "FREE_CARE";

const CARDS: { key: JourneyKey; title: string; desc: string; icon: typeof Stethoscope; target: string }[] = [
  { key: "GENERAL", title: "Branş Doktoru İle Görüş", desc: "Şikayetinizi anlatın; yapay zekâ destekli ön değerlendirmeyle uygun branş doktoruna bağlanın.", icon: Stethoscope, target: "/triyaj" },
  { key: "SECOND_OPINION", title: "İkinci Görüş Al", desc: "Mevcut tanı ve tedavi planınız için bağımsız uzmandan yazılı rapor + video görüşme alın.", icon: FileSearch, target: "/second-opinion/basvur" },
];

const FREE_CARE_CARD = { key: "FREE_CARE" as JourneyKey, title: "Ücretsiz Sağlık Hizmeti İçin Başvur", desc: "Maddi imkânı kısıtlı hastalar için gönüllü doktorlarla ücretsiz video konsültasyon.", icon: HeartHandshake, target: "/ucretsiz-saglik/basvur" };

export function BaslaCards({ name, journey }: { name: string; journey: string | null }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi (v3.5)
  const { t } = useT(lang, texts);
  const [busy, setBusy] = useState<JourneyKey | null>(null);
  const [error, setError] = useState("");

  async function choose(key: JourneyKey, target: string) {
    setError("");
    setBusy(key);
    try {
      const res = await fetch("/api/patient/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey: key }),
      });
      if (!res.ok) throw new Error();
      // Tam sayfa yönlendirme: Header nav bileşimi (journey) sunucudan taze gelsin.
      window.location.assign(target);
    } catch {
      setError(t("İşlem yapılamadı, lütfen tekrar deneyin."));
      setBusy(null);
    }
  }

  const dir = langDir(lang);

  return (
    <div dir={dir}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{t("Hoş geldiniz")}, {name}</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-[#101010]">{t("Nasıl ilerlemek istersiniz?")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("Size uygun yolu seçin — seçiminizi daha sonra değiştirebilirsiniz.")}</p>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <ChoiceCard key={c.key} icon={c.icon} title={t(c.title)} desc={t(c.desc)}
            current={journey === c.key ? t("Mevcut seçiminiz") : null}
            busy={busy === c.key} disabled={busy !== null}
            onClick={() => choose(c.key, c.target)} />
        ))}

        {/* Sağlık Turizmi — "Yakında" (tasarım ayrı iş; karar 2026-07-03) */}
        <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5 opacity-70">
          <span className="absolute end-4 top-4 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("Yakında")}</span>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-400"><Plane size={20} /></span>
          <h2 className="mt-3 text-base font-semibold text-slate-400">{t("Sağlık Turizmini Doktorunla Planla")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("Tedavi, seyahat ve konaklamayı doktorunuzla birlikte uçtan uca planlayın.")}</p>
        </div>

        <ChoiceCard icon={FREE_CARE_CARD.icon} title={t(FREE_CARE_CARD.title)} desc={t(FREE_CARE_CARD.desc)}
          current={journey === FREE_CARE_CARD.key ? t("Mevcut seçiminiz") : null}
          busy={busy === FREE_CARE_CARD.key} disabled={busy !== null}
          onClick={() => choose(FREE_CARE_CARD.key, FREE_CARE_CARD.target)} />
      </div>
    </div>
  );
}

function ChoiceCard({ icon: Icon, title, desc, current, busy, disabled, onClick }: {
  icon: typeof Stethoscope; title: string; desc: string;
  current: string | null; busy: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="group relative rounded-2xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-[#14C3D0]/50 hover:shadow disabled:opacity-60">
      {current && <span className="absolute end-4 top-4 rounded-full bg-[#14C3D0]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0EA5B2]">{current}</span>}
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#14C3D0]/10 text-[#0EA5B2]"><Icon size={20} /></span>
      <h2 className="mt-3 text-base font-semibold text-[#101010]">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0EA5B2]">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} className="transition group-hover:translate-x-0.5 rtl:rotate-180" />}
      </span>
    </button>
  );
}
