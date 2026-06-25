"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ClipboardCheck, HeartHandshake, Video, CircleCheck } from "lucide-react";
import { AuraSpinner } from "@/components/PortamedLogo";
import { ProcessTracker, type TrackerItem } from "@/components/ProcessTracker";
import { proBonoTrackerPhases, PRO_BONO_TRACKER_TEXTS } from "@/lib/pro-bono-tracker";
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
  noDoctorTitle: "Şu an çevrimiçi gönüllü hekim yok",
  searchingTitle: "Gönüllü hekim aranıyor…",
  noDoctorBody:
    "Başvurunuz havuzda. Bir gönüllü hekim çevrimiçi olduğunda görüşme otomatik başlar; bildirimlere izin verdiyseniz bir hekim müsait olduğunda size haber göndereceğiz. İsterseniz bu sayfayı açık tutabilirsiniz.",
  searchingBody:
    "Başvurunuz alındı. Müsait bir gönüllü hekimle eşleştiğinizde görüşme otomatik başlayacak — bu sayfayı açık tutun.",
  queuePos: "Kuyruktaki sıranız:",
  waitingDoctor: "Hekim bekleniyor",
  waitingMatch: "Eşleşme bekleniyor",
} as const;

// Pro Bono bekleme odası — eşleşene kadar poll eder; eşleşince görüşme odasına yönlendirir.
// Hiç çevrimiçi hekim yoksa (online=0) "bir hekim müsait olunca bildirim göndeririz" uyarısı gösterir.
// Çok dilli (8+ dil) + RTL: genel hasta dili (air_lang) + useT; tracker PRO_BONO_TRACKER_TEXTS ile çevrilir.
function WaitingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const caseId = sp.get("caseId");
  const [pos, setPos] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("WAITING");
  const [online, setOnline] = useState<number | null>(null);
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => [...PRO_BONO_TRACKER_TEXTS, ...Object.values(S)], []);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pro-bono/waiting?caseId=${caseId}`);
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
    return <p dir={dir} className="text-sm text-slate-500">{t(S.invalid)}</p>;
  }

  const ended = status !== "WAITING" && status !== "MATCHED";
  const noDoctor = !ended && online === 0;

  const pbItems: TrackerItem[] = proBonoTrackerPhases(status).map((p) => ({
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
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {ended ? (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-100 text-slate-400">
            <Users size={28} />
          </span>
          <h1 className="mt-5 text-xl font-bold text-[#101010]">{t(S.notWaiting)}</h1>
          <p className="mt-2 text-sm text-slate-500">{t(S.statusLabel)} {status}. {t(S.statusFollow)}</p>
        </>
      ) : (
        <>
          {/* Dönen AURA logosu (eski dönen halka yerine) */}
          <AuraSpinner size={48} className="mx-auto block" />
          <h1 className="mt-5 text-xl font-bold text-[#101010]">
            {noDoctor ? t(S.noDoctorTitle) : t(S.searchingTitle)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {noDoctor ? t(S.noDoctorBody) : t(S.searchingBody)}
          </p>
          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 ${noDoctor ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
            <AuraSpinner size={15} className="inline-block" />
            {pos ? (
              <span><Users size={13} className="mb-0.5 me-1 inline" />{t(S.queuePos)} <b className="text-[#101010]">{pos}</b></span>
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

export default function ProBonoWaitingPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <Suspense fallback={<div className="text-center text-sm text-slate-400">…</div>}>
        <WaitingInner />
      </Suspense>
    </div>
  );
}
