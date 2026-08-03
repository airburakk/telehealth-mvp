"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Tek-açık koordinasyonu (2026-08-01, kullanıcı kararı): bir panel açılınca diğerleri kapanır.
// Paneller server-render sayfada kardeş client adaları olduğundan ortak state yerine hafif
// CustomEvent kullanılır — sayfa yapısını değiştirmeden çalışır, masaüstünü etkilemez
// (görünürlük CSS'te hep açık).
const OPEN_EVENT = "aura-panel-open";

// M5 — Doktor Ana Sayfası pencere kabuğu (tutarlı başlık + ikon + opsiyonel rozet/aksiyon + içerik).
//
// Mobil davranış (2026-08-01, kullanıcı kararı — mobil inceleme turu):
// 1) Başlık satırı flex-wrap + min-w-0: rozet/aksiyon bloğu shrink-0 olduğundan dar ekranda
//    başlık+açıklama sütununu 78px'e eziyordu ("Bildirim Tercihi" 11 satıra kırılmıştı);
//    artık rozet sığmazsa başlığın ALTINA sarar, metin tam genişlik alır.
// 2) Akordeon YALNIZ mobil: paneller sm-altında kapalı başlar (başlık = aç/kapa düğmesi,
//    şerit sm:hidden chevron'la işaretli) — tek sütunlu ~2.500px akış kısalır. sm+ HER ZAMAN
//    açık ve tıklama etkisizdir (içerik `hidden sm:block` ile zorlanır; SSR/hydration güvenli —
//    viewport'a bakan JS yok, kırılım tamamen CSS'te).
export function DashboardPanel({
  icon,
  title,
  subtitle,
  badge,
  action,
  children,
  accent = "var(--c-accent)",
  collapsible = true,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  accent?: string;
  /** false = eski davranış (mobilde de hep açık, başlık düğme değil). */
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const uid = useId();
  const mobileHidden = collapsible && collapsed;

  // Başka bir panel açıldığında kapan (tek-açık akordeon).
  useEffect(() => {
    if (!collapsible) return;
    function onOther(e: Event) {
      if ((e as CustomEvent<string>).detail !== uid) setCollapsed(true);
    }
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [collapsible, uid]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      if (!next) window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: uid }));
      return next;
    });
  }

  const headLeft = (
    <>
      {/* Yumuşak zemin + accent renkli ikon (2026-07-31): düz dolgu gece açık kulvar tonlarında
          ink ile düşük kontrast veriyordu; %14 zemin iki temada da güvenli (DutyConsole deseni). */}
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        {/* Aura kiti (Doz 1): pencere başlığı display — landing tipografi hiyerarşisi */}
        <h2 className="aura-display flex items-center gap-1.5 text-[17px] font-medium leading-tight tracking-tight text-[var(--c-ink)]">
          {title}
          {collapsible && (
            <ChevronDown
              size={15}
              className={`shrink-0 text-[var(--c-ink-3)] transition-transform duration-200 sm:hidden ${collapsed ? "" : "rotate-180"}`}
            />
          )}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">{subtitle}</p>}
      </div>
    </>
  );

  return (
    <section className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {collapsible ? (
          /* Başlık = mobilde aç/kapa düğmesi. badge/action AYRI blokta (iç içe interaktif öğe
             oluşmaz). sm+'da tıklama görsel olarak etkisiz — içerik CSS ile daima açık. */
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            className="flex min-w-0 items-center gap-3 text-start sm:cursor-default"
          >
            {headLeft}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">{headLeft}</div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
      <div className={`sm:mt-4 sm:block ${mobileHidden ? "hidden" : "mt-4"}`}>{children}</div>
    </section>
  );
}
