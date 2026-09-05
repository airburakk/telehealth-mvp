"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MasterBar } from "@/components/MasterBar";
import type { ThemeName } from "@/components/ThemeToggle";

interface MeResponse {
  user: { name: string; role: string } | null;
  lang?: string;
  student?: boolean;
  stage1?: boolean;
  imp?: boolean;
  isMaster?: boolean;
  audience?: string | null; // üç katman (2026-09-05): B1 öğrenci kancası için
  trial?: { daysLeft: number; endsAtLabel: string } | null; // Header deneme rozeti
}

// Header/MasterBar sarmalayıcısı (2026-08-28, P0-3) — kök layout artık `cookies()` çağırmadığı
// için (bkz. layout.tsx üstündeki not + /api/auth/me) kullanıcı/tema bilgisi burada CLIENT-SIDE
// çekilir. İlk render misafir (user:null) gösterir — bu güvenli: Header'ın kendisi zaten yalnız
// kozmetik, her korumalı sayfa/API kendi getCurrentUser/requireUser kapısını AYRICA kurar (bkz.
// eski layout.tsx yorumu). Tema, no-flash script'in documentElement'e yazdığı class'tan okunur
// (bkz. layout.tsx NO_FLASH_THEME_SCRIPT) — burada TEKRAR cookie okumaya gerek yok.
export function AppChrome({ doctoriumDeploy }: { doctoriumDeploy: boolean }) {
  const [me, setMe] = useState<MeResponse>({ user: null });
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR/prerender'da document (tema sınıfı) yok → ilk render güvenli varsayılanla, gerçek değer mount'ta bir kez okunur (deps [], cascading yok).
    setTheme(document.documentElement.classList.contains("theme-light") ? "light" : "dark");
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: MeResponse) => setMe(data))
      .catch(() => {});
  }, []);

  return (
    <>
      <Header user={me.user} lang={me.lang} theme={theme} student={me.student} stage1={me.stage1} doctoriumDeploy={doctoriumDeploy} trial={me.trial ?? null} audience={me.audience ?? null} />
      {me.imp ? (
        <MasterBar mode="impersonating" userName={me.user?.name} />
      ) : me.isMaster ? (
        <MasterBar mode="master" />
      ) : null}
    </>
  );
}
