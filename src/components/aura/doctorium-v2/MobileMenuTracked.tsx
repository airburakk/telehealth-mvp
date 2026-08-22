"use client";

import type { ReactNode } from "react";
import { track } from "./track";

// Hamburger etrafında ince istemci kabuğu: açılışı (mobile_menu_open) sayar. Menü bileşeni
// DoctoriumMobileMenu'nun kendisi (v1 ile ortak); burada yalnız tıklama yakalanır —
// aria-expanded'ı false iken gelen tıklama "açılış"tır.
export function MobileMenuTracked({ children }: { children: ReactNode }) {
  return (
    <span
      className="contents"
      onClickCapture={(e) => {
        const btn = (e.target as HTMLElement).closest("button[aria-expanded]");
        if (btn && btn.getAttribute("aria-expanded") === "false") track("mobile_menu_open", "header");
      }}
    >
      {children}
    </span>
  );
}
