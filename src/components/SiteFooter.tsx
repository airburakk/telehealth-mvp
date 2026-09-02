"use client";

import { usePathname } from "next/navigation";
import { hidesFooter } from "@/lib/chrome-routes";
import { AppAuraFooter } from "@/components/aura/aura-footer";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";

// Global alt bilgi — uygulama (giriş yapılmış) yüzeylerinin footer'ı.
//
// 2026-08-18 (kullanıcı kararı): burada 2 satırlık bir MVP bandı vardı; artık AURA
// landing'inin TAM footer'ı çiziliyor (AppAuraFooter → marka bloğu + Platform + Keşfet
// kolonları + legal satırı). Gerekçe: "landing footer'ı içerikteki sayfalarda da korunsun".
// Kapanış CTA'sı taşınmadı — bkz. aura-footer.tsx başlığı.
//
// Kaybolan bir şey yok:
//   • "MVP · Demo amaçlıdır" → sözlükteki f.legal ("© 2026 AURA. MVP demo, not medical
//     advice.") aynı uyarıyı zaten taşıyor.
//   • "Onay Kanıtım" / "Erişim Kaydım" → AppAuraFooter accountLinks ile Platform kolonuna
//     taşındı. ⚠️ Bu iki sayfaya sitedeki TEK giriş noktası burasıdır (Header'da ve hesap
//     menüsünde yok — 2026-08-18 ölçümü); footer'a dokunurken ikisini de düşürme.
//
// Gizleme ekseni hidesFooter(): landing rotaları (kendi footer'ını taşır) + /doktor/doctorium
// ağacı (DoctoriumFooter'ı segment layout'undan çizer). Header ayrı eksende — orada durur.
export function SiteFooter({ doctoriumDeploy = false }: { doctoriumDeploy?: boolean }) {
  const pathname = usePathname();
  if (hidesFooter(pathname)) return null;
  // Doctorium deploy'unda kalan fallback yüzeyler (404/hata + AURA_ONLY_PREFIXES'te olmayan
  // paylaşımlı rotalar) AURA değil Doctorium markalı footer alır — AURA yüzeyleri zaten
  // auraglobalcare.com'a redirect'lendiği için bu deploy'da AURA footer'ının yeri yok.
  // Bayrak kök layout'tan gelir (BRAND_MODE); AppChrome/Header ile aynı desen.
  return doctoriumDeploy ? <DoctoriumFooter /> : <AppAuraFooter />;
}
