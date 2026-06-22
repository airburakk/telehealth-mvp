"use client";

// "Online doktor yoksa 3-seçenek kapısı" (§3.2 mahremiyet/akış) — hasta yüzü, lokalize (useT) + RTL (sayfa kökünden).
// Seçenek 1: Nöbetçi ile şimdi görüş · Seçenek 2: İcapçı branş randevusu (offer/confirm) · Seçenek 3: sonlandır + sil + iade.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/useT";
import { Stethoscope, CalendarClock, Trash2, Loader2, ArrowRight, CheckCircle2, Clock, ShieldQuestion, Video } from "lucide-react";

export interface GateAppt {
  status: string; // REQUESTED | OFFERED | CONFIRMED | CHANGE_REQUESTED
  proposedAtLabel: string | null;
}

const TEXTS = [
  "Şu an çevrimiçi branş hekimi yok",
  "Size en uygun yolu seçin — vakanız kaydedildi, hiçbir bilgi kaybolmaz.",
  "Nöbetçi hekimle şimdi görüşün",
  "7/24 görevli Dahiliye/Acil hekimi sizinle hemen bir video görüşmesi yapar.",
  "Şimdi görüş",
  "Şu an çevrimiçi nöbetçi hekim yok",
  "Branş hekiminizle randevu alın",
  "İcap görevli branş uzmanlarına iletilir; en erken uygun hekim size bir görüşme zamanı önerir.",
  "Randevu iste",
  "Şu an icap görevli branş hekimi yok",
  "Süreci sonlandır",
  "Tüm verileriniz kalıcı olarak silinir ve ödemeniz iade edilir.",
  "Sonlandır ve sil",
  "Tüm vaka verileriniz kalıcı olarak silinecek ve ödemeniz iade edilecek. Emin misiniz?",
  "Randevu talebiniz iletildi",
  "İcap görevli branş hekimleri bilgilendirildi. En erken uygun hekim bir görüşme zamanı önerecek — bu sayfayı açık tutabilirsiniz.",
  "Değişiklik talebiniz iletildi",
  "Hekim yeni bir görüşme zamanı önerecek.",
  "Video randevu teklifi",
  "Önerilen zaman",
  "Onayla",
  "Farklı zaman iste",
  "Randevunuz onaylandı",
  "Görüşmeye katıl",
  "Süreciniz sonlandırıldı",
  "Tüm verileriniz silindi ve ödemeniz iade edildi.",
  "Vakalarıma dön",
  "Bir hata oluştu, lütfen tekrar deneyin.",
  "Bağlanıyor…",
  "İletiliyor…",
];

export function ConsultGate({
  caseId,
  lang,
  hasSentinel,
  hasIcapci,
  appointment,
}: {
  caseId: string;
  lang: string;
  hasSentinel: boolean;
  hasIcapci: boolean;
  appointment: GateAppt | null;
}) {
  const router = useRouter();
  const texts = useMemo(() => TEXTS, []);
  const { t } = useT(lang, texts);
  const [busy, setBusy] = useState<null | string>(null);
  const [err, setErr] = useState<string | null>(null);
  const [terminated, setTerminated] = useState(false);

  async function post(path: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setErr(null);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(typeof d.error === "string" ? d.error : t("Bir hata oluştu, lütfen tekrar deneyin.")); return null; }
      return d;
    } catch {
      setErr(t("Bir hata oluştu, lütfen tekrar deneyin."));
      return null;
    }
  }

  async function sentinelNow() {
    setBusy("sentinel");
    const d = await post(`/api/cases/${caseId}/sentinel-consult`);
    if (d?.consultationId) { router.push(`/gorusme/${d.consultationId}`); return; }
    setBusy(null);
  }
  async function requestIcapci() {
    setBusy("icapci");
    const d = await post(`/api/cases/${caseId}/icapci-request`);
    if (d?.ok) router.refresh();
    setBusy(null);
  }
  async function respond(action: "accept" | "request_change") {
    setBusy(action);
    const d = await post(`/api/cases/${caseId}/appointment`, { action });
    if (d?.ok) router.refresh();
    setBusy(null);
  }
  async function join() {
    setBusy("join");
    const d = await post(`/api/cases/${caseId}/consult`);
    if (d?.consultationId) { router.push(`/gorusme/${d.consultationId}`); return; }
    setBusy(null);
  }
  async function terminate() {
    if (!confirm(t("Tüm vaka verileriniz kalıcı olarak silinecek ve ödemeniz iade edilecek. Emin misiniz?"))) return;
    setBusy("terminate");
    const d = await post(`/api/cases/${caseId}/terminate`);
    if (d?.ok) { setTerminated(true); return; }
    setBusy(null);
  }

  if (terminated) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-600" size={28} />
        <h2 className="mt-2 font-bold text-[#101010]">{t("Süreciniz sonlandırıldı")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("Tüm verileriniz silindi ve ödemeniz iade edildi.")}</p>
        <button onClick={() => router.push("/vakalarim")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
          {t("Vakalarıma dön")} <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // ── Randevu akışı sürüyor (Seçenek 2) ──
  if (appointment && appointment.status !== "CANCELLED") {
    const st = appointment.status;
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {st === "OFFERED" ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0E8A95]"><CalendarClock size={18} /> {t("Video randevu teklifi")}</div>
            <div className="mt-3 rounded-2xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.06] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">{t("Önerilen zaman")}</div>
              <div className="mt-0.5 text-lg font-bold text-[#101010]">{appointment.proposedAtLabel}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => respond("accept")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy === "accept" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {t("Onayla")}
              </button>
              <button onClick={() => respond("request_change")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                {busy === "request_change" ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />} {t("Farklı zaman iste")}
              </button>
            </div>
          </>
        ) : st === "CONFIRMED" ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} /> {t("Randevunuz onaylandı")}</div>
            <div className="mt-2 text-lg font-bold text-[#101010]">{appointment.proposedAtLabel}</div>
            <button onClick={join} disabled={!!busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60">
              {busy === "join" ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {t("Görüşmeye katıl")}
            </button>
          </>
        ) : (
          // REQUESTED | CHANGE_REQUESTED → bekleme
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0E8A95]">
              <Loader2 size={16} className="animate-spin" /> {t(st === "CHANGE_REQUESTED" ? "Değişiklik talebiniz iletildi" : "Randevu talebiniz iletildi")}
            </div>
            <p className="mt-2 text-sm text-slate-500">{t(st === "CHANGE_REQUESTED" ? "Hekim yeni bir görüşme zamanı önerecek." : "İcap görevli branş hekimleri bilgilendirildi. En erken uygun hekim bir görüşme zamanı önerecek — bu sayfayı açık tutabilirsiniz.")}</p>
          </>
        )}
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <button onClick={terminate} disabled={!!busy} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-60">
          <Trash2 size={13} /> {t("Süreci sonlandır")}
        </button>
      </div>
    );
  }

  // ── 3 seçenek ──
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><ShieldQuestion size={18} /></span>
        <div>
          <h2 className="font-bold text-amber-900">{t("Şu an çevrimiçi branş hekimi yok")}</h2>
          <p className="mt-0.5 text-sm text-amber-800/80">{t("Size en uygun yolu seçin — vakanız kaydedildi, hiçbir bilgi kaybolmaz.")}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Seçenek 1 — Nöbetçi şimdi görüş */}
        <GateCard
          icon={<Stethoscope size={18} />}
          tone="teal"
          title={t("Nöbetçi hekimle şimdi görüşün")}
          desc={t("7/24 görevli Dahiliye/Acil hekimi sizinle hemen bir video görüşmesi yapar.")}
          action={
            <button onClick={sentinelNow} disabled={!hasSentinel || !!busy} className="inline-flex items-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:cursor-not-allowed disabled:opacity-50">
              {busy === "sentinel" ? <><Loader2 size={16} className="animate-spin" /> {t("Bağlanıyor…")}</> : <>{t("Şimdi görüş")} <ArrowRight size={16} /></>}
            </button>
          }
          disabledNote={!hasSentinel ? t("Şu an çevrimiçi nöbetçi hekim yok") : null}
        />

        {/* Seçenek 2 — İcapçı branş randevusu */}
        <GateCard
          icon={<CalendarClock size={18} />}
          tone="teal"
          title={t("Branş hekiminizle randevu alın")}
          desc={t("İcap görevli branş uzmanlarına iletilir; en erken uygun hekim size bir görüşme zamanı önerir.")}
          action={
            <button onClick={requestIcapci} disabled={!hasIcapci || !!busy} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#0E8A95] ring-1 ring-[#14C3D0]/40 hover:bg-[#14C3D0]/[0.06] disabled:cursor-not-allowed disabled:opacity-50">
              {busy === "icapci" ? <><Loader2 size={16} className="animate-spin" /> {t("İletiliyor…")}</> : <>{t("Randevu iste")} <ArrowRight size={16} /></>}
            </button>
          }
          disabledNote={!hasIcapci ? t("Şu an icap görevli branş hekimi yok") : null}
        />

        {/* Seçenek 3 — Sonlandır + sil + iade */}
        <GateCard
          icon={<Trash2 size={18} />}
          tone="rose"
          title={t("Süreci sonlandır")}
          desc={t("Tüm verileriniz kalıcı olarak silinir ve ödemeniz iade edilir.")}
          action={
            <button onClick={terminate} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60">
              {busy === "terminate" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {t("Sonlandır ve sil")}
            </button>
          }
          disabledNote={null}
        />
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function GateCard({ icon, tone, title, desc, action, disabledNote }: {
  icon: React.ReactNode; tone: "teal" | "rose"; title: string; desc: string; action: React.ReactNode; disabledNote: string | null;
}) {
  const toneCls = tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-[#14C3D0]/10 text-[#0E8A95]";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneCls}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[#101010]">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
          <div className="mt-3">{action}</div>
          {disabledNote && <p className="mt-1.5 text-xs text-slate-400">{disabledNote}</p>}
        </div>
      </div>
    </div>
  );
}
