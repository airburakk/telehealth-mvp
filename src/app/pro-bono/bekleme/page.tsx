"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ClipboardCheck, HeartHandshake, Video, CircleCheck } from "lucide-react";
import { AuraSpinner } from "@/components/PortamedLogo";
import { ProcessTracker, type TrackerItem } from "@/components/ProcessTracker";
import { proBonoTrackerPhases } from "@/lib/pro-bono-tracker";

const PB_PHASE_ICON = {
  apply: <ClipboardCheck size={14} />,
  match: <HeartHandshake size={14} />,
  consult: <Video size={14} />,
  outcome: <CircleCheck size={14} />,
} as const;

// Pro Bono bekleme odası — eşleşene kadar poll eder; eşleşince görüşme odasına yönlendirir.
// Hiç çevrimiçi hekim yoksa (online=0) "bir hekim müsait olunca bildirim göndeririz" uyarısı gösterir.
function WaitingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const caseId = sp.get("caseId");
  const [pos, setPos] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("WAITING");
  const [online, setOnline] = useState<number | null>(null);

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
    return <p className="text-sm text-slate-500">Geçersiz başvuru. Lütfen tekrar başvurun.</p>;
  }

  const ended = status !== "WAITING" && status !== "MATCHED";
  const noDoctor = !ended && online === 0;

  const pbItems: TrackerItem[] = proBonoTrackerPhases(status).map((p) => ({
    label: p.label,
    subStatus: p.sub,
    state: p.state,
    icon: PB_PHASE_ICON[p.key],
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {ended ? (
        <>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-100 text-slate-400">
            <Users size={28} />
          </span>
          <h1 className="mt-5 text-xl font-bold text-[#101010]">Bu başvuru artık beklemede değil</h1>
          <p className="mt-2 text-sm text-slate-500">Durum: {status}. Vakalarınızdan takip edebilirsiniz.</p>
        </>
      ) : (
        <>
          {/* Dönen AURA logosu (eski dönen halka yerine) */}
          <AuraSpinner size={48} className="mx-auto block" />
          <h1 className="mt-5 text-xl font-bold text-[#101010]">
            {noDoctor ? "Şu an çevrimiçi gönüllü hekim yok" : "Gönüllü hekim aranıyor…"}
          </h1>
          {noDoctor ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Başvurunuz havuzda. Bir gönüllü hekim çevrimiçi olduğunda görüşme otomatik başlar; <b className="text-slate-700">bildirimlere izin verdiyseniz</b> bir hekim müsait olduğunda size haber göndereceğiz. İsterseniz bu sayfayı açık tutabilirsiniz.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Başvurunuz alındı. Müsait bir gönüllü hekimle eşleştiğinizde görüşme otomatik başlayacak — bu sayfayı açık tutun.
            </p>
          )}
          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 ${noDoctor ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
            <AuraSpinner size={15} className="inline-block" />
            {pos ? (
              <span><Users size={13} className="mb-0.5 mr-1 inline" />Kuyruktaki sıranız: <b className="text-[#101010]">{pos}</b></span>
            ) : (
              noDoctor ? "Hekim bekleniyor" : "Eşleşme bekleniyor"
            )}
          </div>
        </>
      )}
      </div>
      <ProcessTracker items={pbItems} />
    </div>
  );
}

export default function ProBonoWaitingPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <Suspense fallback={<div className="text-center text-sm text-slate-400">Yükleniyor…</div>}>
        <WaitingInner />
      </Suspense>
    </div>
  );
}
