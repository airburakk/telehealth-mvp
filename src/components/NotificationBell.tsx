"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Inbox, UserRound, AlertTriangle, Luggage, Scale, Eye, Stethoscope, Smartphone, Loader2 } from "lucide-react";

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
  NEW_CASE: { icon: <UserRound size={14} />, cls: "bg-sky-100 text-sky-700" },
  RED_FLAG: { icon: <AlertTriangle size={14} />, cls: "bg-red-100 text-red-700" },
  BOOKING: { icon: <Luggage size={14} />, cls: "bg-emerald-100 text-emerald-700" },
  COMPLAINT: { icon: <Scale size={14} />, cls: "bg-amber-100 text-amber-700" },
  DECISION: { icon: <Scale size={14} />, cls: "bg-violet-100 text-violet-700" },
  SHARE_ACCESS: { icon: <Eye size={14} />, cls: "bg-slate-100 text-slate-600" },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

// Uygulama içi bildirim merkezi — zil + açılır panel. 30 sn'de bir okunmamış sayısını yoklar;
// panel açılınca rolün okunmamışları okundu işaretlenir.
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Web Push (cihaz bildirimleri): hidden = desteklenmiyor/anahtar yok; off/on = abonelik durumu
  const [pushState, setPushState] = useState<"hidden" | "off" | "on" | "busy">("hidden");
  const pushKeyRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
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
      <button onClick={toggle} title="Bildirimler" className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0f2a4a]">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bildirimler</span>
            {loading && <span className="text-[10px] text-slate-400">yenileniyor…</span>}
          </div>
          {pushState !== "hidden" && (
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <Smartphone size={13} /> Cihaz bildirimleri
                <span className="text-[10px] text-slate-400">(tarayıcı kapalıyken)</span>
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
                {pushState === "on" ? "Açık ✓" : pushState === "busy" ? "…" : "Kapalı — aç"}
              </button>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                <Inbox size={22} className="mx-auto mb-2" /> Bildirim yok.
              </div>
            )}
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? { icon: <Stethoscope size={14} />, cls: "bg-slate-100 text-slate-600" };
              return (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${!n.readAt ? "bg-sky-50/50" : ""}`}
                >
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${meta.cls}`}>{meta.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                    <span className="block text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
