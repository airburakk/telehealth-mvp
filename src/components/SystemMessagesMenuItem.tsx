"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailQuestion } from "lucide-react";
import { useLiveTick } from "@/lib/use-live-tick";

// Header hesap menüsü — "Sistem Mesajları" satırı (v6.79, bildirimlerin hemen altı).
// NotificationBell'in menu-item anatomisiyle birebir; panel AÇMAZ, /mesajlar sayfasına gider
// (mesajlar içerikli/uzun — 320px panelde okunmaz). Rozet: 30sn'de bir hafif sayım (?count=1);
// canlı dürtü "notify" kanalını bildirimlerle paylaşır (tek dürtü ikisini de tazeler).
// onUnreadChange: Header, avatar rozetinde bildirim+mesaj TOPLAMINI gösterir (menü kapalıyken
// görünürlük kaybolmasın — NotificationBell ile aynı sözleşme).
export function SystemMessagesMenuItem({ onUnreadChange, onNavigate }: {
  onUnreadChange?: (n: number) => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    onUnreadChange?.(unread);
    // onUnreadChange bilinçli bağımlılık dışı — Header her render'da yeni referans geçirir
    // (NotificationBell'deki kararın aynısı).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  async function refresh() {
    try {
      const r = await fetch("/api/system-messages?count=1");
      if (!r.ok) return;
      const d = await r.json();
      setUnread(d.unread ?? 0);
    } catch {}
  }
  useLiveTick("notify", refresh, true, 30_000);

  return (
    <button
      onClick={() => { onNavigate?.(); router.push("/mesajlar"); }}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]"
    >
      <MailQuestion size={15} />
      <span className="flex-1">Sistem Mesajları</span>
      {unread > 0 && (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
