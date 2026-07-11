"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ClipboardCheck, HeartHandshake, Video, CircleCheck } from "lucide-react";
import { AuraSpinner } from "@/components/PortamedLogo";
import { ProcessTracker, type TrackerItem } from "@/components/ProcessTracker";
import { freeCareTrackerPhases, FREE_CARE_TRACKER_TEXTS } from "@/lib/free-care-tracker";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";

const PB_PHASE_ICON = {
  apply: <ClipboardCheck size={14} />,
  match: <HeartHandshake size={14} />,
  consult: <Video size={14} />,
  outcome: <CircleCheck size={14} />,
} as const;

// Sayfa sabit metinleri (TR kanonik) — useT ile hasta diline çevrilir.
const S = {
  invalid: "Geçersiz başvuru. Lütfen tekrar başvurun.",
  notWaiting: "Bu başvuru artık beklemede değil",
  statusLabel: "Durum:",
  statusFollow: "Vakalarınızdan takip edebilirsiniz.",
  noDoctorTitle: "Şu an çevrimiçi gönüllü doktor yok",
  searchingTitle: "Gönüllü doktor aranıyor…",
  noDoctorBody:
    "Başvurunuz havuzda. Bir gönüllü doktor çevrimiçi olduğunda görüşme otomatik başlar; bildirimlere izin verdiyseniz bir doktor müsait olduğunda size haber göndereceğiz. İsterseniz bu sayfayı açık tutabilirsiniz.",
  searchingBody:
    "Başvurunuz alındı. Müsait bir gönüllü doktorla eşleştiğinizde görüşme otomatik başlayacak — bu sayfayı açık tutun.",
  queuePos: "Kuyruktaki sıranız:",
  waitingDoctor: "Doktor bekleniyor",
  waitingMatch: "Eşleşme bekleniyor",
} as const;

// Ücretsiz Sağlık Hizmeti bekleme odası — eşleşene kadar poll eder; eşleşince görüşme odasına yönlendirir.
// Hiç çevrimiçi doktor yoksa (online=0) "bir doktor müsait olunca bildirim göndeririz" uyarısı gösterir.
// Çok dilli (8+ dil) + RTL: genel hasta dili (air_lang) + useT; tracker FREE_CARE_TRACKER_TEXTS ile çevrilir.
function WaitingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const caseId = sp.get("caseId");
  const [pos, setPos] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("WAITING");
  const [online, setOnline] = useState<number | null>(null);
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => [...FREE_CARE_TRACKER_TEXTS, ...Object.values(S)], []);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/free-care/waiting?caseId=${caseId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        if (d.status === "MATCHED" && d.consultationId) {
          router.push(`/gorusme/${d.consultationId}`);
          return;
        }
        setStatus(d.status ?? "WAITING");
        if (d.status === "WAITING") {
          setPos(typeof d.queuePos === "number" ? d.queuePos : null);
          setOnline(typeof d.online === "number" ? d.online : null);
        }
      } catch {
        /* ağ hatası — sonraki tick tekrar dener */
      }
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [caseId, router]);

  if (!caseId) {
    return <p dir={dir} className="text-sm text-white/50">{t(S.invalid)}</p>;
  }

  const ended = status !== "WAITING" && status !== "MATCHED";
  const noDoctor = !ended && online === 0;

  const pbItems: TrackerItem[] = freeCareTrackerPhases(status).map((p) => ({
    label: t(p.label),
    subStatus: t(p.sub),
    state: p.state,
    icon: PB_PHASE_ICON[p.key],
  }));

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex justify-end">
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>
      <div className="rounded-3xl border border-white/10 bg-[#161719] p-8 text-center shadow-sm">
      {ended ? (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-white/40">
            <Users size={28} />
          </span>
          <h1 className="mt-5 text-xl font-bold text-[#F4F5F3]">{t(S.notWaiting)}</h1>
          <p className="mt-2 text-sm text-white/50">{t(S.statusLabel)} {status}. {t(S.statusFollow)}</p>
        </>
      ) : (
        <>
          {/* Dönen AURA logosu (eski dönen halka yerine) */}
          <AuraSpinner size={48} className="mx-auto block" />
          <h1 className="mt-5 text-xl font-bold text-[#F4F5F3]">
            {noDoctor ? t(S.noDoctorTitle) : t(S.searchingTitle)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            {noDoctor ? t(S.noDoctorBody) : t(S.searchingBody)}
          </p>
          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 ${noDoctor ? "bg-red-500/10 text-red-300 ring-red-400/25" : "bg-[#1E1F22] text-white/65 ring-white/10"}`}>
            <AuraSpinner size={15} className="inline-block" />
            {pos ? (
              <span><Users size={13} className="mb-0.5 me-1 inline" />{t(S.queuePos)} <b className="text-[#F4F5F3]">{pos}</b></span>
            ) : (
              noDoctor ? t(S.waitingDoctor) : t(S.waitingMatch)
            )}
          </div>
        </>
      )}
      </div>
      <ProcessTracker items={pbItems} dir={dir} />
    </div>
  );
}

export default function FreeCareWaitingPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <Suspense fallback={<div className="text-center text-sm text-white/40">…</div>}>
        <WaitingInner />
      </Suspense>
    </div>
  );
}
