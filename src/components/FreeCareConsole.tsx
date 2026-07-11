"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { countryFlag, urgencyStyle, formatDateTime } from "@/lib/constants";
import { FREE_CARE_STATES } from "@/lib/free-care-labels";
import { HeartHandshake, Loader2, Power, Users, Award, Stethoscope, CheckCircle2, Activity, Radio } from "lucide-react";

export interface PBCase {
  id: string;
  patientName: string;
  country: string;
  language: string;
  branch: string;
  urgency: number;
  symptoms: string;
  freeCareStatus: string;
  createdAt: string;
}

interface Quota { used: number; quota: number; left: number }

export function FreeCareConsole({
  initialState,
  quota: initialQuota,
  waitingCount: initialWaiting,
  badge,
  awaiting,
  recent,
}: {
  initialState: string;
  quota: Quota;
  waitingCount: number;
  badge: { consultations: number; converted: number };
  awaiting: PBCase[];
  recent: PBCase[];
}) {
  const router = useRouter();
  const [serverState, setServerState] = useState(initialState);
  const [available, setAvailable] = useState(initialState === "AVAILABLE");
  const [quota, setQuota] = useState<Quota>(initialQuota);
  const [waiting, setWaiting] = useState(initialWaiting);
  const [busy, setBusy] = useState(false);

  // Müsaitken eşleşme için poll; eşleşince görüşme odasına yönlendirir.
  useEffect(() => {
    if (!available) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/free-care/doctor-feed");
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        setWaiting(d.waitingCount ?? 0);
        if (d.quota) setQuota(d.quota);
        if (d.consultationId) { router.push(`/gorusme/${d.consultationId}`); return; }
        if (d.state && d.state !== "AVAILABLE") { setServerState(d.state); setAvailable(false); } // kota doldu / dışarıdan değişti
      } catch {
        /* ağ hatası — sonraki tick tekrar dener */
      }
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [available, router]);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/free-care/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: next }),
      });
      const d = await r.json();
      if (!r.ok) {
        // v4.19: sunucunun anlaşılır hatası (ör. verified 403) sessizce yutulmasın
        window.alert(d.error ?? "İşlem başarısız — lütfen tekrar deneyin.");
        return;
      }
      if (d.consultationId) { router.push(`/gorusme/${d.consultationId}`); return; }
      if (d.quota) setQuota(d.quota);
      setServerState(d.state ?? "OFFLINE");
      setAvailable(d.state === "AVAILABLE");
    } catch {
      /* yoksay */
    } finally {
      setBusy(false);
    }
  }

  async function markOutcome(caseId: string, outcome: "CONSULT_DONE" | "TREATMENT_NEEDED") {
    setBusy(true);
    try {
      await fetch("/api/free-care/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, outcome }),
      });
      setServerState("OFFLINE");
      setAvailable(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const quotaFull = quota.left <= 0;
  const inSession = serverState === "IN_SESSION";

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#28C8D8]/10 text-[#17919E]"><HeartHandshake size={20} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F3]">Ücretsiz Sağlık Hizmeti Konsolu</h1>
          <p className="text-sm text-white/50">Gönüllü ücretsiz konsültasyon — müsaitlik açın, triyaj sizi bekleyen hastayla eşleştirsin.</p>
        </div>
      </div>

      {/* Müsaitlik + kota + bekleyen */}
      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/75">
              <StateDot state={serverState} /> Durum: <span className="text-[#F4F5F3]">{FREE_CARE_STATES_DOCTOR[serverState] ?? serverState}</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1E1F22] px-3 py-1 text-xs font-medium text-white/65 ring-1 ring-white/10">
              <Users size={13} /> {waiting} bekleyen hasta
            </span>
          </div>

          {inSession ? (
            <div className="mt-4 rounded-2xl border border-violet-400/25 bg-violet-50/70 px-4 py-3 text-sm text-violet-200">
              Şu an bir görüşmedesiniz. Görüşme bitince aşağıdan <b>sonucu işaretleyin</b>; ardından tekrar müsait olabilirsiniz.
            </div>
          ) : quotaFull ? (
            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Bu haftaki ücretsiz hizmet kontenjanınız doldu ({quota.used}/{quota.quota}). Kontenjan her hafta yenilenir.
            </div>
          ) : (
            <button
              onClick={() => toggle(!available)}
              disabled={busy}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                available ? "bg-[#26272B] text-white hover:bg-[#101113]" : "bg-[#28C8D8] text-[#0D0E10] hover:bg-[#1FA9B8]"
              }`}
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : available ? <Power size={17} /> : <Radio size={17} />}
              {available ? "Çevrimdışı ol" : "Müsait ol — hasta bekle"}
            </button>
          )}

          {available && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/50">
              <Loader2 size={13} className="animate-spin text-[#28C8D8]" /> Eşleşme bekleniyor — bu sayfayı açık tutun
            </div>
          )}
        </div>

        {/* Kota + itibar */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><Activity size={14} /> Haftalık Kontenjan</div>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-2xl font-bold text-[#F4F5F3]">{quota.used}<span className="text-base font-normal text-white/40">/{quota.quota}</span></span>
              <span className="text-xs text-white/50">{quota.left} hak kaldı</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#28C8D8]" style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.quota)) * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-3xl border border-[#28C8D8]/25 bg-teal-50/60 p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#28C8D8]"><Award size={14} /> Ücretsiz Hizmet Katkınız</div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-center">
              <div><div className="text-2xl font-bold text-[#28C8D8]">{badge.consultations}</div><div className="text-[11px] text-[#28C8D8]">görüşme</div></div>
              <div><div className="text-2xl font-bold text-[#28C8D8]">{badge.converted}</div><div className="text-[11px] text-[#28C8D8]">tedaviye yönlendirildi</div></div>
            </div>
          </div>
        </aside>
      </div>

      {/* Sonuç bekleyen görüşmeler */}
      {awaiting.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-white/75">Görüşme sonucunu işaretleyin</h2>
          <div className="mt-2 space-y-3">
            {awaiting.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
                <CaseHead c={c} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => markOutcome(c.id, "CONSULT_DONE")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} /> Tedavi gerekmez — kapat
                  </button>
                  <button
                    onClick={() => markOutcome(c.id, "TREATMENT_NEEDED")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-60"
                  >
                    <Stethoscope size={15} /> Tedavi gerekiyor — etik kurula gönder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Geçmiş */}
      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-white/75">Son ücretsiz hizmet vakalarınız</h2>
          <ul className="mt-2 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#161719]">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white/75">{countryFlag(c.country)} {c.patientName} · {c.branch}</div>
                  <div className="text-xs text-white/40">{formatDateTime(c.createdAt)}</div>
                </div>
                <span className="shrink-0 rounded-full bg-[#1E1F22] px-2.5 py-1 text-[11px] font-medium text-white/65 ring-1 ring-white/10">
                  {FREE_CARE_STATES[c.freeCareStatus] ?? c.freeCareStatus}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {awaiting.length === 0 && recent.length === 0 && (
        <p className="mt-8 rounded-2xl bg-[#1E1F22] px-4 py-8 text-center text-sm text-white/40">
          Henüz ücretsiz hizmet görüşmeniz yok. Müsait olun; bekleyen bir hastayla eşleştiğinizde görüşme otomatik başlar.
        </p>
      )}
    </div>
  );
}

const FREE_CARE_STATES_DOCTOR: Record<string, string> = {
  OFFLINE: "Çevrimdışı",
  AVAILABLE: "Müsait",
  IN_SESSION: "Görüşmede",
};

function StateDot({ state }: { state: string }) {
  const cls = state === "AVAILABLE" ? "bg-emerald-500" : state === "IN_SESSION" ? "bg-violet-500" : "bg-white/20";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function CaseHead({ c }: { c: PBCase }) {
  const u = urgencyStyle(c.urgency);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#F4F5F3]">{countryFlag(c.country)} {c.patientName}</span>
        <span className="rounded-lg bg-[#1E1F22] px-2 py-0.5 text-xs font-medium text-white/65 ring-1 ring-white/10">{c.branch}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${u.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} /> {c.urgency}/5
        </span>
        <span className="text-xs text-white/40">· {c.language}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-white/65">{c.symptoms}</p>
    </div>
  );
}
