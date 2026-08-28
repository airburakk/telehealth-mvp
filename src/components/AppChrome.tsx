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
    setTheme(document.documentElement.classList.contains("theme-light") ? "light" : "dark");
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: MeResponse) => setMe(data))
      .catch(() => {});
  }, []);

  return (
    <>
      <Header user={me.user} lang={me.lang} theme={theme} student={me.student} stage1={me.stage1} doctoriumDeploy={doctoriumDeploy} />
      {me.imp ? (
        <MasterBar mode="impersonating" userName={me.user?.name} />
      ) : me.isMaster ? (
        <MasterBar mode="master" />
      ) : null}
    </>
  );
}
