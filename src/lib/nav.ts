// Üst bant (Header) nav öğeleri — rol + hasta yolculuğu (patientJourney) bazlı saf filtre.
// Header'dan ayrıştırıldı: birim testlenebilir (tests/unit/nav.test.ts).
//
// Hasta nav kararı (2026-07-03): PATIENT yalnız Vakalarım · Post Op · Paylaşımlarım görür
// (Triyaj/Ücretsiz Sağlık Hizmeti/Doktorlar sekmeleri kalktı — yeni başvuru /basla seçim ekranından başlar).
// İkinci Görüş yolculuğundaki hastada (journey=SECOND_OPINION) Paylaşımlarım da gizlenir ve
// Vakalarım SO vaka listesine işaret eder.
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
  { href: "/vakalarim", label: "Vakalarım", icon: FolderHeart, roles: ["PATIENT", "ADMIN"] },
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

export function navItemsFor(role: string | null | undefined, journey?: string | null): NavItem[] {
  if (!role) return [];
  let items = NAV.filter((n) => n.roles.includes(role));
  if (role === "PATIENT" && journey === "SECOND_OPINION") {
    items = items
      .filter((n) => n.href !== "/paylasimlarim")
      .map((n) => (n.href === "/vakalarim" ? { ...n, href: "/second-opinion/vakalarim" } : n));
  }
  return items;
}
