"use client";

import { useEffect } from "react";

// Ekran dışına çıkan SÜREKLİ DEKORATİF animasyonları duraklatır (tasarım kuralı:
// "off-screen continuous animation pauses"). Ölçüldü 2026-07-15: landing'de 9 sonsuz
// animasyonlu elemandan 4'ü ilk ekranda görünmüyordu ama dönmeye devam ediyordu;
// 4'ü `filter` kullanıyor (kompozitörde en pahalı tür).
//
// NEDEN TEK GLOBAL GÖZLEMCİ (bileşen içi hook değil): AuraMark/AuraSpinner KASITLI
// olarak hook'suzdur → server component'lerde kullanılabiliyor (v6.7 kararı). İçine
// useEffect koymak onu client'a çekerdi. Bunun yerine sınıf DIŞARIDAN uygulanır;
// sembol saf SVG kalır.
//
// Duraklatma `animation-play-state: paused` ile — animasyon kaldırılmaz, dondurulur:
// geri görünür olunca kaldığı kareden sürer (yeniden başlatma zıplaması olmaz).
const SELECTOR = ".aura-sym-orbit, .aura-sym-core, .aura-sym-pulse, .aura-word";
const PAUSED = "aura-anim-paused";

export function AuraAnimPause() {
  useEffect(() => {
    // reduced-motion'da animasyon zaten `none` → gözlemciye gerek yok.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle(PAUSED, !e.isIntersecting);
      },
      // rootMargin: kenarda erken devreye girsin — kullanıcı elemana varmadan animasyon
      // çoktan akıyor olur, "donuk girip canlanma" görünmez.
      { rootMargin: "150px" },
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      for (const el of document.querySelectorAll(SELECTOR)) {
        if (seen.has(el)) continue;
        seen.add(el);
        io.observe(el);
      }
    };
    scan();

    // Rota geçişi / geç mount edilen bileşenler için: DOM değişince yeni elemanları yakala.
    // rAF ile tek kareye toplanır (childList+subtree çok sık tetiklenir).
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
