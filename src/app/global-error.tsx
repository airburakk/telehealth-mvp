"use client";

// Küresel hata sınırı — kök layout dahil her şey çöktüğünde devreye girer.
// Kendi <html>/<body> iskeletini kurmak ZORUNDADIR; globals.css/Tailwind bu
// noktada yüklenmemiş olabileceğinden yalnız inline style (system-ui) kullanılır.
// Header/Footer yok, minimal. Metinler statik gömülü sözlükten (lib/error-i18n);
// error.message gösterilmez, yalnız digest referans olarak gösterilir.
//
// 🪤 RENKLER SABİT, var(--c-*) DEĞİL: globals.css kök layout'ta import edilir; bu bileşen
// layout'u ATLAR, dolayısıyla token'lar tanımsız kalabilir — var() çözülmeyince zemin şeffaf,
// buton görünmez olurdu (2026-08-19'da bulundu: yorum "inline style" diyordu ama değerler
// token'a bağlıydı). Değerler gece temasının sabit karşılığı: --c-bg #0d0e10 · --c-panel
// #161719 · --c-ink #f4f5f3 (nötr, iki markada da aynı). CTA butonu marka-duyarlı — aşağıdaki
// NEXT_PUBLIC_SITE_URL bloğuna bak. Nötr token değişirse burası ELLE güncellenir.

import { useEffect, useState } from "react";
import { ERROR_I18N, errDir, pickLang } from "@/lib/error-i18n";

// Marka-duyarlı CTA (T2 global-error dokunuşu, 2026-09-04): bu bileşen kök layout'u ATLADIĞI için
// <body data-brand> / --c-cta token'ına erişemez (globals.css yüklenmemiş olabilir). Marka BUILD-TIME
// NEXT_PUBLIC_SITE_URL'den çıkarılır (Doctorium deploy = doctorium.tr; AURA = auraglobalcare.com).
// Doctorium: zümrüt #047857 + beyaz metin (globals.css --c-cta ile AYNI, 5.3:1 AA); AURA: turkuaz
// #28c8d8 + koyu (eski davranış). Sabit inline değer → SSR ve client aynı, renk flash'ı yok.
// ⚠️ --c-cta değişirse burayı da güncelle (bu bileşen token okuyamaz).
const IS_DOCTORIUM_CTA = (process.env.NEXT_PUBLIC_SITE_URL ?? "").includes("doctorium");
const CTA_BG = IS_DOCTORIUM_CTA ? "#047857" : "#28c8d8";
const CTA_INK = IS_DOCTORIUM_CTA ? "#ffffff" : "#0d0e10";

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  // SSR'da navigator yok → önce TR, dil istemcide useEffect ile seçilir.
  const [lang, setLang] = useState("tr");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR/prerender'da navigator yok → ilk render güvenli varsayılanla, gerçek değer mount'ta bir kez okunur (deps [], cascading yok).
  useEffect(() => setLang(pickLang(navigator)), []);
  const t = ERROR_I18N[lang];

  return (
    <html lang={lang} dir={errDir(lang)}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "#0d0e10",
          color: "#f4f5f3",
          fontFamily: "system-ui, 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#161719",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#f4f5f3" }}>{t.errorTitle}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,.55)" }}>{t.errorDesc}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              border: "none",
              borderRadius: 8,
              background: CTA_BG,
              color: CTA_INK,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
          {error?.digest && (
            <p style={{ margin: "16px 0 0", fontSize: 11, color: "rgba(255,255,255,.4)" }}>
              {t.reference}: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
