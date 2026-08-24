// Doctorium (halka açık landing + /doctorium/giris) — yalnız SEKME İKONUNU zümrüde çevirir.
// Görsel/yapısal hiçbir katman eklemez: children'ı olduğu gibi geçirir.
//
// Kullanıcı kararı 2026-08-19: sekme ikonu = marka renginde DOLU daire + tam siyah amblem;
// AURA yüzeylerinde TURKUAZ (#28C8D8), Doctorium yüzeylerinde ZÜMRÜT (#34d399) — her marka
// kendi tonunu taşır (ara turda takas denendi, Doctorium'un kimliği zümrüt olduğu için geri alındı).
//
// 🪤 Neden dosya konvansiyonu (`icon.ico`) DEĞİL: denendi, dosya rota olarak servis edildi
// (HTTP 200) ama Next `<link rel="icon">` basmadı — kök `src/app/favicon.ico` onu bastırıyordu.
// Çözüm: kök favicon.ico kaldırıldı, ikonlar `public/` altına alındı ve `metadata.icons` ile
// açıkça bağlandı (kök layout varsayılanı burada override edilir). Detay: scripts/gen-icons.py.

import type { Metadata } from "next";

export const metadata: Metadata = {
  // 🪤 `?v=` cache-kırıcı — gerekçe kök layout.tsx'te. İkon değişince ÜÇ layout'ta birlikte artır.
  icons: { icon: "/icon-doctorium.ico?v=2", apple: "/apple-touch-icon.png" },
};

export default function DoctoriumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
