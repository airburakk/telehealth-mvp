"use client";

// M5 Faz 3 — konsültasyon görüntülü görüşme kontrolleri (İcapçı offer/respond).
// Doktor "öner" → partner "kabul/ret" → SCHEDULED → her iki taraf "odaya katıl".
// Karşı tarafın online rozeti presence'ten (poll). Partner tarafı useT ile kendi dilinde.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Video, Loader2, Check, X, Wifi, WifiOff } from "lucide-react";
import { useT } from "@/components/useT";
import { langDir, LANG_BCP47 } from "@/lib/constants";

interface VideoAppt {
  id: string; status: string; proposedAt: string; scheduledAt: string | null;
  doctorOnline: boolean; partnerOnline: boolean;
}

const CHROME = [
  "Görüntülü görüşme",
  "Görüntülü görüşme öner",
  "Teklif gönderildi · yanıt bekleniyor",
  "Görüntülü görüşme teklifi",
  "Kabul et",
  "Reddet",
  "Görüşmeye katıl",
  "çevrimiçi",
  "çevrimdışı",
  "Karşı taraf",
];

export function VideoControls({ requestId, role, lang = "Türkçe" }: { requestId: string; role: "doctor" | "partner"; lang?: string }) {
  const [video, setVideo] = useState<VideoAppt | null>(null);
  const [busy, setBusy] = useState("");
  const { t } = useT(lang, CHROME);
  const dir = langDir(lang);
  const locale = LANG_BCP47[lang] ?? "tr-TR";

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/consultation-requests/${requestId}/video`);
      if (!r.ok) return;
      const d = await r.json();
      setVideo(d.video ?? null);
    } catch {}
  }, [requestId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 10_000);
    return () => clearInterval(i);
  }, [load]);

  async function act(action: string) {
    setBusy(action);
    try {
      const r = await fetch(`/api/consultation-requests/${requestId}/video`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.video) setVideo(d.video);
      else await load();
    } catch {} finally { setBusy(""); }
  }

  const counterpartOnline = role === "doctor" ? video?.partnerOnline : video?.doctorOnline;
  const status = video?.status;
  const joinHref = video ? `/konsultasyon/gorusme/${video.id}` : "#";

  return (
    <div dir={dir} className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300"><Video size={14} /> {t("Görüntülü görüşme")}</span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${counterpartOnline ? "text-emerald-300" : "text-[var(--c-ink-3)]"}`}>
          {counterpartOnline ? <Wifi size={12} /> : <WifiOff size={12} />} {t("Karşı taraf")} {counterpartOnline ? t("çevrimiçi") : t("çevrimdışı")}
        </span>
      </div>

      <div className="mt-2">
        {status === "SCHEDULED" ? (
          <Link href={joinHref} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-[#06343a] hover:bg-[var(--c-accent-strong)]">
            <Video size={15} /> {t("Görüşmeye katıl")}
          </Link>
        ) : role === "doctor" ? (
          status === "OFFERED" ? (
            <p className="text-xs text-violet-300">{t("Teklif gönderildi · yanıt bekleniyor")}{video?.proposedAt ? ` (${new Date(video.proposedAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })})` : ""}</p>
          ) : (
            <button onClick={() => act("offer")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
              {busy === "offer" ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />} {t("Görüntülü görüşme öner")}
            </button>
          )
        ) : (
          // partner
          status === "OFFERED" ? (
            <div>
              <p className="text-xs font-medium text-violet-300">{t("Görüntülü görüşme teklifi")}{video?.proposedAt ? ` · ${new Date(video.proposedAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => act("accept")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {busy === "accept" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t("Kabul et")}
                </button>
                <button onClick={() => act("decline")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-[var(--c-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] ring-1 ring-[var(--c-hairline)] hover:bg-[var(--c-surface)] disabled:opacity-50">
                  {busy === "decline" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} {t("Reddet")}
                </button>
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
