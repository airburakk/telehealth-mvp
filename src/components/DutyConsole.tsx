"use client";

// Klinik Nöbet Konsolu (doktor, TR) — 3-seçenek kapısının doktor tarafı.
// Branş kliniği çevrimiçi (gerçek-zaman) · İcap açık (offline randevu) · Nöbetçi (7/24 genel).
// Çevrimiçi/Nöbetçiyken poll: Nöbetçi olarak kapılırsan görüşmeye yönlendirir; İcap açıkken gelen randevu taleplerini gösterir.
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveTick } from "@/lib/use-live-tick";
import { countryFlag, urgencyStyle, formatDateTime } from "@/lib/constants";
import { Radio, Power, Loader2, ShieldPlus, CalendarClock, Send, Activity, Users } from "lucide-react";
import type { DutyRequest } from "@/lib/clinical-duty";

interface DutyState {
  state: string; // OFFLINE | ONLINE | IN_SESSION
  onCall: boolean;
  sentinel: boolean;
  branch: string;
}

export function DutyConsole({ initial, initialRequests }: { initial: DutyState; initialRequests: DutyRequest[] }) {
  const router = useRouter();
  const [duty, setDuty] = useState<DutyState>(initial);
  const [requests, setRequests] = useState<DutyRequest[]>(initialRequests);
  const [busy, setBusy] = useState<null | string>(null);

  const active = duty.onCall || duty.state !== "OFFLINE" || duty.sentinel;

  // Çevrimiçi/İcap/Nöbetçiyken canlı durum (v6.28): Ably "live:duty" dürtüsü + adaptif güvenlik-ağı
  // (Ably yoksa eski 3sn) — eşleşme (görüşme) + gelen randevu talepleri.
  useLiveTick(
    "duty",
    async () => {
      try {
        const r = await fetch("/api/clinical/duty");
        if (!r.ok) return;
        const d = await r.json();
        if (d.consultationId) { router.push(`/gorusme/${d.consultationId}`); return; }
        if (d.state) setDuty({ state: d.state, onCall: !!d.onCall, sentinel: !!d.sentinel, branch: d.branch ?? duty.branch });
        if (Array.isArray(d.requests)) setRequests(d.requests);
      } catch { /* ağ — sonraki tick */ }
    },
    active,
  );

  const patch = useCallback(async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const r = await fetch("/api/clinical/duty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.state) setDuty({ state: d.state, onCall: !!d.onCall, sentinel: !!d.sentinel, branch: d.branch ?? duty.branch });
      if (Array.isArray(d.requests)) setRequests(d.requests);
    } finally { setBusy(null); }
  }, [duty.branch]);

  async function offer(caseId: string, scheduledAt: string) {
    const r = await fetch(`/api/cases/${caseId}/appointment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "offer", scheduledAt }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setRequests((rs) => rs.filter((x) => x.caseId !== caseId)); router.refresh(); return { ok: true }; }
    return { ok: false, error: typeof d.error === "string" ? d.error : "Teklif gönderilemedi." };
  }

  const inSession = duty.state === "IN_SESSION";
  const online = duty.state === "ONLINE";

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--c-accent)]/10 text-[var(--c-accent-stronger)]"><Activity size={20} /></span>
        <div className="min-w-0">
          <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">Klinik Nöbet</h2>
          <p className="text-sm text-[var(--c-ink-2)]">Branşınız: <b className="text-[var(--c-ink)]">{duty.branch}</b> · hastalar çevrimiçi doktor yoksa size ulaşır.</p>
        </div>
        <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--c-surface)] px-3 py-1 text-xs font-medium text-[var(--c-ink-2)] ring-1 ring-white/10">
          <StateDot state={duty.state} /> {STATE_LABEL[duty.state] ?? duty.state}
        </span>
      </div>

      {inSession ? (
        <div className="mt-4 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
          <p>Şu an bir nöbet görüşmesindesiniz.</p>
          <button
            onClick={() => patch({ release: true }, "release")}
            disabled={!!busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-panel)] px-3.5 py-2 text-sm font-semibold text-violet-300 ring-1 ring-violet-400/25 hover:bg-violet-500/10 disabled:opacity-60"
          >
            {busy === "release" ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />} Görüşmeyi bitirdim — nöbete dön
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {/* Branş kliniği online */}
          <button
            onClick={() => patch({ clinicalState: online ? "OFFLINE" : "ONLINE" }, "clinical")}
            disabled={!!busy}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-start transition disabled:opacity-60 ${online ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] hover:bg-[var(--c-surface)]"}`}
          >
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${online ? "text-[var(--c-accent-stronger)]" : "text-[var(--c-ink)]"}`}>
              {busy === "clinical" ? <Loader2 size={15} className="animate-spin" /> : online ? <Radio size={15} /> : <Power size={15} />}
              Branş kliniği
            </span>
            <span className="text-xs text-[var(--c-ink-2)]">{online ? "Çevrimiçi — gerçek-zaman" : "Çevrimdışı"}</span>
          </button>

          {/* İcap açık */}
          <button
            onClick={() => patch({ onCall: !duty.onCall }, "oncall")}
            disabled={!!busy}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-start transition disabled:opacity-60 ${duty.onCall ? "border-amber-400/30 bg-amber-500/10" : "border-[var(--c-hairline)] hover:bg-[var(--c-surface)]"}`}
          >
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${duty.onCall ? "text-amber-300" : "text-[var(--c-ink)]"}`}>
              {busy === "oncall" ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
              İcap (randevu)
            </span>
            <span className="text-xs text-[var(--c-ink-2)]">{duty.onCall ? "Açık — randevu talepleri gelir" : "Kapalı"}</span>
          </button>

          {/* Nöbetçi */}
          <button
            onClick={() => patch({ sentinel: !duty.sentinel }, "sentinel")}
            disabled={!!busy}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-start transition disabled:opacity-60 ${duty.sentinel ? "border-emerald-400/30 bg-emerald-500/10" : "border-[var(--c-hairline)] hover:bg-[var(--c-surface)]"}`}
          >
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${duty.sentinel ? "text-emerald-300" : "text-[var(--c-ink)]"}`}>
              {busy === "sentinel" ? <Loader2 size={15} className="animate-spin" /> : <ShieldPlus size={15} />}
              Nöbetçi (7/24)
            </span>
            <span className="text-xs text-[var(--c-ink-2)]">{duty.sentinel ? "Genel/Dahiliye nöbeti açık" : "Kapalı"}</span>
          </button>
        </div>
      )}

      {active && !inSession && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--c-ink-2)]">
          <Loader2 size={13} className="animate-spin text-[var(--c-accent)]" /> Nöbetteyken bekleyin — eşleşme veya randevu talebi geldiğinde burada belirir.
        </div>
      )}

      {/* İcapçı gelen kutusu */}
      {duty.onCall && (
        <div className="mt-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink-2)]"><Users size={14} /> Randevu talepleri {requests.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">{requests.length}</span>}</h3>
          {requests.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-[var(--c-surface)] px-4 py-6 text-center text-sm text-[var(--c-ink-3)]">Açık randevu talebi yok. İcap açıkken branşınızdaki talepler buraya düşer.</p>
          ) : (
            <div className="mt-2 space-y-3">
              {requests.map((req) => <RequestCard key={req.caseId} req={req} onOffer={offer} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, onOffer }: { req: DutyRequest; onOffer: (caseId: string, scheduledAt: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const u = urgencyStyle(req.urgency);
  const isChange = req.status === "CHANGE_REQUESTED";

  async function submit() {
    if (!when) { setError("Lütfen bir tarih/saat seçin."); return; }
    setBusy(true); setError(null);
    const r = await onOffer(req.caseId, when);
    if (!r.ok) { setError(r.error ?? "Hata"); setBusy(false); }
  }

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${isChange ? "border-amber-400/30 bg-amber-500/10" : "border-[var(--c-hairline)] bg-[var(--c-panel)]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[var(--c-ink)]">{countryFlag(req.country)} {req.patientName}</span>
        <span className="rounded-lg bg-[var(--c-surface)] px-2 py-0.5 text-xs font-medium text-[var(--c-ink-2)] ring-1 ring-[var(--c-hairline)]">{req.branch}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${u.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} /> {req.urgency}/5
        </span>
        <span className="text-xs text-[var(--c-ink-3)]">· {req.language} · {formatDateTime(req.createdAt)}</span>
        {isChange && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">değişiklik istendi</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-[var(--c-ink-2)]">{req.symptoms}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]"
        />
        <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {isChange ? "Yeni zaman öner" : "Randevu teklif et"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

const STATE_LABEL: Record<string, string> = { OFFLINE: "Çevrimdışı", ONLINE: "Çevrimiçi", IN_SESSION: "Görüşmede" };

function StateDot({ state }: { state: string }) {
  const cls = state === "ONLINE" ? "bg-emerald-500" : state === "IN_SESSION" ? "bg-violet-500" : "bg-[var(--c-ink)]/20";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}
