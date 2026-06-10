"use client";

import { useEffect } from "react";

// Service worker kaydı — yalnız üretimde (dev'de HMR ile çakışmasın).
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
