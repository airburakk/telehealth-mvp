// Doctorium (halka açık landing + /doctorium/giris) — yalnız SEKME İKONUNU zümrüde çevirir.
// Görsel/yapısal hiçbir katman eklemez: children'ı olduğu gibi geçirir.
//
// Kullanıcı kararı 2026-08-23 (v6.137, marka seti v2): sekme ikonu = KOYU DİSK + holografik
// KÜRE; AURA yüzeylerinde TURKUAZ küre, Doctorium yüzeylerinde ZÜMRÜT küre (hue −30°) — her
// marka kendi tonunu taşır (2026-08-19'daki "dolu renkli daire + siyah amblem" süpersede).
//
// 🪤 Neden dosya konvansiyonu (`icon.ico`) DEĞİL: denendi, dosya rota olarak servis edildi
// (HTTP 200) ama Next `<link rel="icon">` basmadı — kök `src/app/favicon.ico` onu bastırıyordu.
// Çözüm: kök favicon.ico kaldırıldı, ikonlar `public/` altına alındı ve `metadata.icons` ile
// açıkça bağlandı (kök layout varsayılanı burada override edilir). Detay: scripts/gen-icons.py.

import type { Metadata } from "next";

export const metadata: Metadata = {
  // Ayrışma (2026-08-24): sekme başlığı kök şablonun "%s · AURA"sını EZER — Doctorium
  // yüzeylerinde AURA adı geçmez. appleWebApp adı da Doctorium (ana ekrana ekleme).
  // 🪤 `default` YETMEZ: çocuk default'u KÖKÜN şablonuna yerleştirilir — üst şablonu yalnız
  // `absolute` iptal eder; template alt sayfalara (giris "Giriş · Doctorium") uygulanır.
  title: { absolute: "Doctorium", template: "%s · Doctorium" },
  appleWebApp: { capable: true, title: "Doctorium", statusBarStyle: "default" },
  // 🪤 `?v=` cache-kırıcı — gerekçe kök layout.tsx'te. İkon değişince ÜÇ layout'ta birlikte artır.
  icons: { icon: "/icon-doctorium.ico?v=3", apple: "/apple-touch-icon.png?v=3" },
};

export default function DoctoriumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
