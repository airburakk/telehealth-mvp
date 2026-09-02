import type { Metadata } from "next";
import { DoctoriumFooter } from "@/components/aura/doctorium-footer";

// Yönetim dizini kabuğu (2026-08-29, kullanıcı kararı — 2. tur).
//
// NEDEN: yönetici Doctorium portalındayken üst banttan "Yönetim"e tıklayınca AURA kromuna
// düşüyordu ("Management ve Operation'a tıkladığın anda Aura'ya dönüyor"). /admin panellerinin
// çoğu zaten Doctorium işidir — kampanya · anket · etkinlik · ödüller · landing-analitik · üye
// analitiği. Dizin artık Doctorium'un yönetim yüzeyi sayılır; AURA'ya özgü olanlar (Personel
// Onayı, denetim kısayolları) dizinden çıkarıldı.
//
// Krom üç eksende birden çözülür, üçü de lib/chrome-routes.ts'te:
//   · hidesGlobalChrome → FALSE (Header durur; yönetici gezinmeye muhtaç)
//   · hidesFooter       → TRUE  (global AURA footer'ı susar, buradaki DoctoriumFooter çizer)
//   · usesDoctoriumBrand→ TRUE  (Header'ın marka bloğu Doctorium olur)
// 🪤 Buraya DoctoriumFooter eklendiği için alt sayfalar KENDİ footer'ını çizmemeli — /admin/uyeler
// ilk turda çiziyordu, layout gelince çift footer olurdu; oradan kaldırıldı.
export const metadata: Metadata = {
  // 🪤 `default` YETMEZ: çocuğun default'u KÖK şablona ("%s · AURA") yerleştirilir ve sekmede
  // AURA adı belirir. Üst şablonu yalnız `absolute` iptal eder; `template` alt sayfalara işler
  // (doktor/doctorium/layout.tsx'te ölçülmüş aynı tuzak).
  title: { absolute: "Yönetim · Doctorium", template: "%s · Doctorium" },
  // Sekme ikonu da Doctorium (zümrüt küre) — kökün turkuaz varsayılanını ezer.
  // ⚠️ İkon sürümü değişince ÜÇ layout'ta birlikte artır (kök · doktor/doctorium · burası).
  icons: { icon: "/icon-doctorium.ico?v=3", apple: "/apple-touch-icon-doctorium.png?v=1" }, // iOS ikonu da zümrüt (Faz E, 2026-09-03)
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Rol kapısı BİLİNÇLİ olarak burada değil: her /admin sayfası kendi getCurrentUser + ADMIN
  // kontrolünü yapar (derinlik savunması). Layout'a ikinci bir DB okuması eklemek her sayfa
  // yüklemesini pahalılaştırır ve mevcut kapıları gereksiz kılmaz.
  return (
    <>
      {children}
      <DoctoriumFooter />
    </>
  );
}
