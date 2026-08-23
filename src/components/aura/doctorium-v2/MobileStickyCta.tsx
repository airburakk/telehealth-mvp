"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { track } from "./track";

// Mobil yapışkan CTA (belge §1 mobil wireframe): hero geçildikten sonra görünür, final CTA
// bölümü (#basla) görünürken ve masaüstünde (md+) gizli. IntersectionObserver; yoksa hiç çizilmez
// (sayfa akışı bozulmaz). Çerez/consent katmanı yok (projede yok) → üst üste binme riski yok.
// Yükseklik 56px; sayfa dibine pb payı DoctoriumLandingV2 verir (footer kapanmasın).
export function MobileStickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const final = document.getElementById("basla");
    if (!hero || !final || typeof IntersectionObserver === "undefined") return;
    let heroVisible = true;
    let finalVisible = false;
    const update = () => setShow(!heroVisible && !finalVisible);
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.target === hero) heroVisible = en.isIntersecting;
        if (en.target === final) finalVisible = en.isIntersecting;
      }
      update();
    }, { threshold: 0.1 });
    io.observe(hero);
    io.observe(final);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-[var(--dl-line)] bg-[color-mix(in_srgb,var(--dl-bg)_92%,transparent)] px-4 py-2 backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href={LANDING_ROUTES.signup}
        tabIndex={show ? 0 : -1}
        onClick={() => track("create_doctorium_click", "sticky")}
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#065f46] text-[15px] font-semibold text-white"
      >
        <span>Doctorium&apos;unu oluştur</span>
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
