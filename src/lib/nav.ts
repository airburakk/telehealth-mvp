// Üst bant (Header) nav öğeleri — rol bazlı saf filtre.
// Header'dan ayrıştırıldı: birim testlenebilir (tests/unit/nav.test.ts).
//
// Hasta nav kararı (2026-07-03): PATIENT yalnız Vakalarım · Post Op · Paylaşımlarım görür.
// /basla 4'lü seçimi kaldırıldı (2026-07-12): yeni başvuru doğrudan /triyaj'dan; diğer kulvarlara
// köprü Vakalarım üstündeki kulvar kartlarındadır (MyCasesList).
import {
  Stethoscope, UserRound, HeartPulse, Scale, Users, BadgeCheck, Share2, BarChart3,
  FolderHeart, HeartHandshake, Globe, Luggage, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

const NAV: NavItem[] = [
  // "Bakım Yolculuğum" (v6.17, backlog P1): hasta-yüzü ad — hasta kendini "vaka"
  // olarak görmemeli. ⚠️ ROTA DEĞİŞMEDİ (/vakalarim: bookmark + dış bağlantılar);
  // klinik personel yüzeylerinde (aşağıda /doktor…) "vaka" terminolojisi KALIR
  // (backlog: keep clinician terminology as case/vaka). Etiket ADMIN'de de bu —
  // admin hasta yüzeyini hasta gözüyle denetler, ayrı personel sekmeleri zaten var.
  { href: "/vakalarim", label: "Bakım Yolculuğum", icon: FolderHeart, roles: ["PATIENT", "ADMIN"] },
  { href: "/takip", label: "Post Op", icon: HeartPulse, roles: ["PATIENT"] },
  { href: "/paylasimlarim", label: "Paylaşımlarım", icon: Share2, roles: ["PATIENT", "ADMIN"] },
  { href: "/triyaj", label: "Triyaj", icon: UserRound, roles: ["ADMIN"] },
  { href: "/hekimler", label: "Doktorlar", icon: Users, roles: ["ADMIN"] },
  { href: "/operasyon", label: "Operasyon", icon: BarChart3, roles: ["COORDINATOR", "ADMIN"] },
  { href: "/doktor", label: "Doktor", icon: Stethoscope, roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  { href: "/doktor/takip", label: "Post-Op", icon: HeartPulse, roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  { href: "/doktor/ucretsiz-saglik", label: "Ücretsiz Hizmet", icon: HeartHandshake, roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  { href: "/doktor/profil", label: "Profilim", icon: BadgeCheck, roles: ["DOCTOR", "ADMIN"] },
  { href: "/etik-kurul", label: "Etik Kurul", icon: Scale, roles: ["ETHICS", "ADMIN"] },
  { href: "/partner", label: "Partner", icon: Globe, roles: ["PARTNER", "ADMIN"] },
  { href: "/acente", label: "Tedavi Dosyaları", icon: Luggage, roles: ["AGENCY"] }, // S3 acente kuyruğu (FAZ 4)
];

// Tam birleşme (2026-07-12, kullanıcı kararı): SO dahil tüm kulvarlar /vakalarim'da tek listede —
// journey-bazlı SO daraltması (Vakalarım→SO yeniden yazımı + Paylaşımlarım gizleme) kaldırıldı;
// hasta nav'ı herkes için aynı.
export function navItemsFor(role: string | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV.filter((n) => n.roles.includes(role));
}
