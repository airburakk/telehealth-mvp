"use client";

// "Online doktor yoksa 3-seçenek kapısı" (§3.2 mahremiyet/akış) — hasta yüzü, lokalize (useT) + RTL (sayfa kökünden).
// Seçenek 1: Nöbetçi ile şimdi görüş · Seçenek 2: İcapçı branş randevusu (offer/confirm) · Seçenek 3: sonlandır + sil + iade.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/useT";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Stethoscope, CalendarClock, Trash2, Loader2, ArrowRight, CheckCircle2, Clock, ShieldQuestion, Video } from "lucide-react";

export interface GateAppt {
  status: string; // REQUESTED | OFFERED | CONFIRMED | CHANGE_REQUESTED
  proposedAtLabel: string | null;
}

const TEXTS = [
  "Şu an çevrimiçi branş doktoru yok",
  "Size en uygun yolu seçin — vakanız kaydedildi, hiçbir bilgi kaybolmaz.",
  "Nöbetçi doktorla şimdi görüşün",
  "7/24 görevli Dahiliye/Acil doktoru sizinle hemen bir video görüşmesi yapar.",
  "Şimdi görüş",
  "Şu an çevrimiçi nöbetçi doktor yok",
  "Branş doktorunuzle randevu alın",
  "İcap görevli branş uzmanlarına iletilir; en erken uygun doktor size bir görüşme zamanı önerir.",
  "Randevu iste",
  "Şu an icap görevli branş doktoru yok",
  "Süreci sonlandır",
  "Tüm verileriniz kalıcı olarak silinir ve ödemeniz iade edilir.",
  "Sonlandır ve sil",
  "Tüm vaka verileriniz kalıcı olarak silinecek ve ödemeniz iade edilecek. Emin misiniz?",
  "Vazgeç",
  "Randevu talebiniz iletildi",
  "İcap görevli branş doktorları bilgilendirildi. En erken uygun doktor bir görüşme zamanı önerecek — bu sayfayı açık tutabilirsiniz.",
  "Değişiklik talebiniz iletildi",
  "Doktor yeni bir görüşme zamanı önerecek.",
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
  const [confirmTerminate, setConfirmTerminate] = useState(false);

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
  // Native confirm() yerine ConfirmDialog (2026-07-12): buton diyaloğu açar, onay doTerminate'i koşar.
  function terminate() {
    setConfirmTerminate(true);
  }
  async function doTerminate() {
    setBusy("terminate");
    const d = await post(`/api/cases/${caseId}/terminate`);
    if (d?.ok) { setConfirmTerminate(false); setTerminated(true); return; }
    setConfirmTerminate(false);
    setBusy(null);
  }
  const terminateDialog = (
    <ConfirmDialog
      open={confirmTerminate}
      message={t("Tüm vaka verileriniz kalıcı olarak silinecek ve ödemeniz iade edilecek. Emin misiniz?")}
      confirmLabel={t("Sonlandır ve sil")}
      cancelLabel={t("Vazgeç")}
      danger
      busy={busy === "terminate"}
      onConfirm={doTerminate}
      onCancel={() => setConfirmTerminate(false)}
    />
  );

  if (terminated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-300" size={28} />
        <h2 className="mt-2 font-bold text-[#F4F5F3]">{t("Süreciniz sonlandırıldı")}</h2>
        <p className="mt-1 text-sm text-white/50">{t("Tüm verileriniz silindi ve ödemeniz iade edildi.")}</p>
        <button onClick={() => router.push("/vakalarim")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
          {t("Vakalarıma dön")} <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // ── Randevu akışı sürüyor (Seçenek 2) ──
  if (appointment && appointment.status !== "CANCELLED") {
    const st = appointment.status;
    return (
      <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        {st === "OFFERED" ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]"><CalendarClock size={18} /> {t("Video randevu teklifi")}</div>
            <div className="mt-3 rounded-2xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.06] px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-white/40">{t("Önerilen zaman")}</div>
              <div className="mt-0.5 text-lg font-bold text-[#F4F5F3]">{appointment.proposedAtLabel}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => respond("accept")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy === "accept" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {t("Onayla")}
              </button>
              <button onClick={() => respond("request_change")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/65 hover:bg-[#1E1F22] disabled:opacity-60">
                {busy === "request_change" ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />} {t("Farklı zaman iste")}
              </button>
            </div>
          </>
        ) : st === "CONFIRMED" ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle2 size={18} /> {t("Randevunuz onaylandı")}</div>
            <div className="mt-2 text-lg font-bold text-[#F4F5F3]">{appointment.proposedAtLabel}</div>
            <button onClick={join} disabled={!!busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-60">
              {busy === "join" ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {t("Görüşmeye katıl")}
            </button>
          </>
        ) : (
          // REQUESTED | CHANGE_REQUESTED → bekleme
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]">
              <Loader2 size={16} className="animate-spin" /> {t(st === "CHANGE_REQUESTED" ? "Değişiklik talebiniz iletildi" : "Randevu talebiniz iletildi")}
            </div>
            <p className="mt-2 text-sm text-white/50">{t(st === "CHANGE_REQUESTED" ? "Doktor yeni bir görüşme zamanı önerecek." : "İcap görevli branş doktorları bilgilendirildi. En erken uygun doktor bir görüşme zamanı önerecek — bu sayfayı açık tutabilirsiniz.")}</p>
          </>
        )}
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        <button onClick={terminate} disabled={!!busy} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-red-300 disabled:opacity-60">
          <Trash2 size={13} /> {t("Süreci sonlandır")}
        </button>
        {terminateDialog}
      </div>
    );
  }

  // ── 3 seçenek ──
  return (
    <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-300"><ShieldQuestion size={18} /></span>
        <div>
          <h2 className="font-bold text-amber-200">{t("Şu an çevrimiçi branş doktoru yok")}</h2>
          <p className="mt-0.5 text-sm text-amber-200/90">{t("Size en uygun yolu seçin — vakanız kaydedildi, hiçbir bilgi kaybolmaz.")}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Seçenek 1 — Nöbetçi şimdi görüş */}
        <GateCard
          icon={<Stethoscope size={18} />}
          tone="teal"
          title={t("Nöbetçi doktorla şimdi görüşün")}
          desc={t("7/24 görevli Dahiliye/Acil doktoru sizinle hemen bir video görüşmesi yapar.")}
          action={
            <button onClick={sentinelNow} disabled={!hasSentinel || !!busy} className="inline-flex items-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:cursor-not-allowed disabled:opacity-50">
              {busy === "sentinel" ? <><Loader2 size={16} className="animate-spin" /> {t("Bağlanıyor…")}</> : <>{t("Şimdi görüş")} <ArrowRight size={16} /></>}
            </button>
          }
          disabledNote={!hasSentinel ? t("Şu an çevrimiçi nöbetçi doktor yok") : null}
        />

        {/* Seçenek 2 — İcapçı branş randevusu */}
        <GateCard
          icon={<CalendarClock size={18} />}
          tone="teal"
          title={t("Branş doktorunuzle randevu alın")}
          desc={t("İcap görevli branş uzmanlarına iletilir; en erken uygun doktor size bir görüşme zamanı önerir.")}
          action={
            <button onClick={requestIcapci} disabled={!hasIcapci || !!busy} className="inline-flex items-center gap-2 rounded-lg bg-[#161719] px-4 py-2.5 text-sm font-semibold text-[#17919E] ring-1 ring-[#28C8D8]/40 hover:bg-[#28C8D8]/[0.06] disabled:cursor-not-allowed disabled:opacity-50">
              {busy === "icapci" ? <><Loader2 size={16} className="animate-spin" /> {t("İletiliyor…")}</> : <>{t("Randevu iste")} <ArrowRight size={16} /></>}
            </button>
          }
          disabledNote={!hasIcapci ? t("Şu an icap görevli branş doktoru yok") : null}
        />

        {/* Seçenek 3 — Sonlandır + sil + iade */}
        <GateCard
          icon={<Trash2 size={18} />}
          tone="rose"
          title={t("Süreci sonlandır")}
          desc={t("Tüm verileriniz kalıcı olarak silinir ve ödemeniz iade edilir.")}
          action={
            <button onClick={terminate} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/50 hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60">
              {busy === "terminate" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {t("Sonlandır ve sil")}
            </button>
          }
          disabledNote={null}
        />
      </div>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      {terminateDialog}
    </div>
  );
}

function GateCard({ icon, tone, title, desc, action, disabledNote }: {
  icon: React.ReactNode; tone: "teal" | "rose"; title: string; desc: string; action: React.ReactNode; disabledNote: string | null;
}) {
  const toneCls = tone === "rose" ? "bg-rose-500/10 text-rose-300" : "bg-[#28C8D8]/10 text-[#17919E]";
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161719] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneCls}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[#F4F5F3]">{title}</h3>
          <p className="mt-0.5 text-sm text-white/50">{desc}</p>
          <div className="mt-3">{action}</div>
          {disabledNote && <p className="mt-1.5 text-xs text-white/40">{disabledNote}</p>}
        </div>
      </div>
    </div>
  );
}
