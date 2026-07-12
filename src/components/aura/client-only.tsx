"use client";

import { useEffect, useState, type ReactNode } from "react";

// Yalnız mount sonrası render (vitrinden taşındı): SmoothScroll gibi salt
// tarayıcı katmanları SSR çıktısına hiç girmez — hydration uyuşmazlığı riski sıfır.
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
