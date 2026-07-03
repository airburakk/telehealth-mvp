"use client";

// Küresel hata sınırı — kök layout dahil her şey çöktüğünde devreye girer.
// Kendi <html>/<body> iskeletini kurmak ZORUNDADIR; globals.css/Tailwind bu
// noktada yüklenmemiş olabileceğinden yalnız inline style (system-ui) kullanılır.
// Header/Footer yok, minimal. Metinler statik gömülü sözlükten (lib/error-i18n);
// error.message gösterilmez, yalnız digest referans olarak gösterilir.

import { useEffect, useState } from "react";
import { ERROR_I18N, errDir, pickLang } from "@/lib/error-i18n";

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  // SSR'da navigator yok → önce TR, dil istemcide useEffect ile seçilir.
  const [lang, setLang] = useState("tr");
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
          background: "#eef1f5",
          color: "#1a1f29",
          fontFamily: "system-ui, 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1e293b" }}>{t.errorTitle}</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#64748b" }}>{t.errorDesc}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              border: "none",
              borderRadius: 8,
              background: "#14C3D0",
              color: "#101010",
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
            <p style={{ margin: "16px 0 0", fontSize: 11, color: "#94a3b8" }}>
              {t.reference}: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
