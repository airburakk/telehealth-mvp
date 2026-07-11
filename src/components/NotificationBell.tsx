"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Inbox, UserRound, AlertTriangle, Luggage, Scale, Eye, Stethoscope, Smartphone, Loader2, FileText, MessageSquare, Video } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";

// VAPID public key → PushManager.subscribe formatı
function urlB64ToUint8(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: React.ReactNode; cls: string }> = {
  NEW_CASE: { icon: <UserRound size={14} />, cls: "bg-teal-100 text-teal-700" },
  RED_FLAG: { icon: <AlertTriangle size={14} />, cls: "bg-red-100 text-red-700" },
  BOOKING: { icon: <Luggage size={14} />, cls: "bg-emerald-100 text-emerald-700" },
  OFFER: { icon: <FileText size={14} />, cls: "bg-violet-100 text-violet-700" },
  COMPLAINT: { icon: <Scale size={14} />, cls: "bg-amber-100 text-amber-700" },
  DECISION: { icon: <Scale size={14} />, cls: "bg-violet-100 text-violet-700" },
  SHARE_ACCESS: { icon: <Eye size={14} />, cls: "bg-slate-100 text-slate-600" },
  MISSING_DOCS: { icon: <FileText size={14} />, cls: "bg-amber-100 text-amber-700" },
  CONSULT_ANSWERED: { icon: <MessageSquare size={14} />, cls: "bg-violet-100 text-violet-700" },
  CONSULT_MESSAGE: { icon: <MessageSquare size={14} />, cls: "bg-sky-100 text-sky-700" },
  CONSULT_VIDEO: { icon: <Video size={14} />, cls: "bg-violet-100 text-violet-700" },
};

// Çevrilecek sabit arayüz metinleri (krom). timeAgo şablonları {n} yer tutuculudur → Claude {n}'i korur.
const CHROME = [
  "Bildirimler",
  "yenileniyor…",
  "Bildirim yok.",
  "Cihaz bildirimleri",
  "(tarayıcı kapalıyken)",
  "Açık ✓",
  "Kapalı — aç",
  "iPhone'da cihaz bildirimi için:",
  "Safari'de Paylaş (□↑) → Ana Ekrana Ekle deyin, sonra uygulamayı ana ekrandaki ikondan açın — bu anahtar orada görünür. (iOS 16.4+)",
  "az önce",
  "{n} dk önce",
  "{n} sa önce",
  "{n} gün önce",
];

function timeAgo(iso: string, t: (s: string) => string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return t("az önce");
  if (s < 3600) return t("{n} dk önce").replace("{n}", String(Math.floor(s / 60)));
  if (s < 86400) return t("{n} sa önce").replace("{n}", String(Math.floor(s / 3600)));
  return t("{n} gün önce").replace("{n}", String(Math.floor(s / 86400)));
}

// Uygulama içi bildirim merkezi — zil + açılır panel. 30 sn'de bir okunmamış sayısını yoklar;
// panel açılınca rolün okunmamışları okundu işaretlenir.
// Dil: Header `lang` prop'u (Partner gibi dil-tercihli kullanıcı) öncelikli; hasta ise (`patientLangFallback`)
// localStorage dili (`air_lang`). Personel TR-sabit — `air_lang` artık halka açık yüzeylerden de
// (landing/public sayfalar) yazılabildiğinden, paylaşılan tarayıcıda personel arayüzü rol kapısı
// olmadan beklenmedik dile dönerdi.
export function NotificationBell({ lang = "Türkçe", patientLangFallback = false }: { lang?: string; patientLangFallback?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const [patientLang] = usePatientLang();
  const effLang = lang && lang !== "Türkçe" ? lang : patientLangFallback ? patientLang : "Türkçe";
  // Krom + açılır paneldeki dinamik bildirim metinleri (title/body) birlikte çevrilir.
  // `texts` referansını İÇERİK imzasına göre sabitle: `refresh()` her çağrıda yeni bir
  // items dizisi üretir; içerik aynıyken referans değişirse useT'nin effect'i gereksiz
  // yeniden çalışıp uçuştaki fetch'i iptal eder ve sig aynı olduğu için bir daha çekmez
  // (çeviri hiç yüklenmez). Aynı içerikte aynı referans → bu yarış kapanır.
  const dynSig = items.map((n) => `${n.title}${n.body ?? ""}`).join("");
  const texts = useMemo(
    () => [...CHROME, ...items.flatMap((n) => [n.title, n.body ?? ""]).filter(Boolean)],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kasıtlı olarak içerik imzasıyla anahtarlanır
    [dynSig]
  );
  const { t } = useT(effLang, texts);
  const dir = langDir(effLang);

  // Web Push (cihaz bildirimleri): hidden = desteklenmiyor/anahtar yok; ios-hint = iPhone Safari
  // (Apple, Push API'yi yalnız Ana Ekrana eklenmiş uygulamada açar); off/on = abonelik durumu
  const [pushState, setPushState] = useState<"hidden" | "ios-hint" | "off" | "on" | "busy">("hidden");
  const pushKeyRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        // "in window" daraltması TS'te window'u never'a indirger — global nesneyi kayıtla yokla
        const g = globalThis as unknown as Record<string, unknown>;
        if (!g.PushManager || !g.Notification) {
          // iPhone/iPad Safari sekmesi: Push API yok ama Ana Ekrana Ekle ile gelir → yol göster
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const standalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as unknown as { standalone?: boolean }).standalone === true;
          if (isIOS && !standalone) setPushState("ios-hint");
          return;
        }
        const r = await fetch("/api/push");
        if (!r.ok) return;
        const d = await r.json();
        if (!d.enabled || !d.publicKey) return; // VAPID yok → özellik gizli
        pushKeyRef.current = d.publicKey;
        const reg = await navigator.serviceWorker.ready; // yalnız üretimde kayıtlı (dev'de askıda kalır)
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : "off");
      } catch {}
    })();
  }, []);

  async function togglePush() {
    if (pushState !== "on" && pushState !== "off") return;
    const turnOn = pushState === "off";
    setPushState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      if (turnOn) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setPushState("off"); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8(pushKeyRef.current!) as unknown as ArrayBuffer,
        });
        const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
        if (!r.ok) throw new Error();
        setPushState("on");
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setPushState("off");
      }
    } catch {
      setPushState(turnOn ? "off" : "on");
    }
  }

  async function refresh() {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items ?? []);
      setUnread(d.unread ?? 0);
    } catch {}
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  // Dış tıklamada kapat
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refresh();
      setLoading(false);
      if (unread > 0) {
        try { await fetch("/api/notifications", { method: "POST" }); setUnread(0); } catch {}
      }
    }
  }

  function go(n: Notif) {
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  return (
    <div ref={boxRef} className="relative">
      <button onClick={toggle} title={t("Bildirimler")} className="relative grid h-9 w-9 place-items-center rounded-lg text-white/55 hover:bg-white/10 hover:text-[#28C8D8]">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div dir={dir} className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Bildirimler")}</span>
            {loading && <span className="text-[10px] text-slate-400">{t("yenileniyor…")}</span>}
          </div>
          {pushState === "ios-hint" && (
            <div className="border-b border-slate-100 bg-teal-50/70 px-4 py-2.5">
              <div className="flex items-start gap-2 text-xs leading-relaxed text-teal-800">
                <Smartphone size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>{t("iPhone'da cihaz bildirimi için:")}</strong>{" "}
                  {t("Safari'de Paylaş (□↑) → Ana Ekrana Ekle deyin, sonra uygulamayı ana ekrandaki ikondan açın — bu anahtar orada görünür. (iOS 16.4+)")}
                </span>
              </div>
            </div>
          )}
          {pushState !== "hidden" && pushState !== "ios-hint" && (
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <Smartphone size={13} /> {t("Cihaz bildirimleri")}
                <span className="text-[10px] text-slate-400">{t("(tarayıcı kapalıyken)")}</span>
              </span>
              <button
                onClick={togglePush}
                disabled={pushState === "busy"}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${
                  pushState === "on"
                    ? "bg-emerald-100 text-emerald-700 ring-emerald-200 hover:bg-emerald-200"
                    : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {pushState === "busy" ? <Loader2 size={11} className="animate-spin" /> : null}
                {pushState === "on" ? t("Açık ✓") : pushState === "busy" ? "…" : t("Kapalı — aç")}
              </button>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                <Inbox size={22} className="mx-auto mb-2" /> {t("Bildirim yok.")}
              </div>
            )}
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? { icon: <Stethoscope size={14} />, cls: "bg-slate-100 text-slate-600" };
              return (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${!n.readAt ? "bg-teal-50/50" : ""}`}
                >
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${meta.cls}`}>{meta.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{t(n.title)}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{t(n.body)}</span>}
                    <span className="block text-[10px] text-slate-400">{timeAgo(n.createdAt, t)}</span>
                  </span>
                  {!n.readAt && <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
