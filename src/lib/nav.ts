// Üst bant (Header) nav öğeleri — rol bazlı saf filtre.
// Header'dan ayrıştırıldı: birim testlenebilir (tests/unit/nav.test.ts).
//
// Hasta nav kararı (2026-07-03): PATIENT yalnız Vakalarım · Post Op · Paylaşımlarım görür.
// /basla 4'lü seçimi kaldırıldı (2026-07-12): yeni başvuru doğrudan /triyaj'dan; diğer kulvarlara
// köprü Vakalarım üstündeki kulvar kartlarındadır (MyCasesList).
import type { ComponentType } from "react";
import {
  Stethoscope, UserRound, HeartPulse, Scale, Users, Share2, BarChart3,
  FolderHeart, Globe, Luggage, LayoutDashboard,
} from "lucide-react";

// İkon sözleşmesi: Header <Icon size={16}/> çağırır. OPSİYONEL — ikonsuz öğede (Doctorium)
// Header etiketi mobilde de gösterir (yoksa mobil bantta öğe kaybolurdu: etiket sm+ gizli).
type NavIcon = ComponentType<{ size?: number; className?: string }>;

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIcon;
  roles: string[];
}

const NAV: NavItem[] = [
  // Yönetim dizini (v6.71; v6.73 sadeleştirmesiyle bandın BAŞINA alındı — admin'in ana aracı).
  // Paneller + denetim görünümleri /admin dizin sayfasından dağılır (kullanıcı kararı: bant
  // büyümez, dizin büyür). Yalnız ADMIN; diğer roller bu öğeyi hiç görmez.
  { href: "/admin", label: "Yönetim", icon: LayoutDashboard, roles: ["ADMIN"] },
  // "Bakım Yolculuğum" (v6.17, backlog P1): hasta-yüzü ad — hasta kendini "vaka"
  // olarak görmemeli. ⚠️ ROTA DEĞİŞMEDİ (/vakalarim: bookmark + dış bağlantılar);
  // klinik personel yüzeylerinde (aşağıda /doktor…) "vaka" terminolojisi KALIR
  // (backlog: keep clinician terminology as case/vaka).
  // v6.73 ADMIN bant sadeleştirmesi (kullanıcı kararı — 11 öğe geniş ekranda bile taşıyordu):
  // ADMIN bandı = Yönetim · Operasyon · Doktor · Doctorium. Hasta/rol yüzeyi DENETİM kısayolları
  // (Bakım Yolculuğum · Paylaşımlarım · Triyaj · Doktorlar · Post-Op · Etik Kurul · Partner)
  // banttan çıktı ama KAYBOLMADI → /admin "Denetim görünümleri" bölümü. Rol sayfalarının kendi
  // erişim kuralları değişmedi (ADMIN rotalara yine girebilir; yalnız bant kısayolu taşındı).
  { href: "/vakalarim", label: "Bakım Yolculuğum", icon: FolderHeart, roles: ["PATIENT"] },
  { href: "/takip", label: "Post Op", icon: HeartPulse, roles: ["PATIENT"] },
  { href: "/paylasimlarim", label: "Paylaşımlarım", icon: Share2, roles: ["PATIENT"] },
  { href: "/operasyon", label: "Operasyon", icon: BarChart3, roles: ["COORDINATOR", "ADMIN"] },
  { href: "/doktor", label: "Doktor", icon: Stethoscope, roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  { href: "/doktor/takip", label: "Post-Op", icon: HeartPulse, roles: ["DOCTOR", "COORDINATOR"] },
  // Doctorium (v6.48, 2026-08-01) — hekim bilgi portalı. Eski "Haberler" adı ve /doktor/haberler
  // rotası bırakıldı (rota 308 ile buraya yönlenir; yer imleri kırılmasın).
  // İKONSUZ (kullanıcı kararı 2026-08-01, 2. tur): Header özel yazı-lockup basar —
  // "Doctor" + yanıp sönen zümrüt "ium" (.doctorium-ium-breathe); sembol yalnız sayfa başlığında.
  { href: "/doktor/doctorium", label: "Doctorium", roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  // "Ücretsiz Hizmet" bant linki kaldırıldı (2026-07-31, kullanıcı kararı) — rota + ana sayfa paneli durur.
  // "Profilim" bant linki kaldırıldı (2026-08-01, kullanıcı kararı) — artık header hesap
  // menüsünde (Header.tsx); rota /doktor/profil aynen durur.
  { href: "/etik-kurul", label: "Etik Kurul", icon: Scale, roles: ["ETHICS"] },
  { href: "/partner", label: "Partner", icon: Globe, roles: ["PARTNER"] },
  { href: "/acente", label: "Tedavi Dosyaları", icon: Luggage, roles: ["AGENCY"] }, // S3 acente kuyruğu (FAZ 4)
];

// Tam birleşme (2026-07-12, kullanıcı kararı): SO dahil tüm kulvarlar /vakalarim'da tek listede —
// journey-bazlı SO daraltması (Vakalarım→SO yeniden yazımı + Paylaşımlarım gizleme) kaldırıldı;
// hasta nav'ı herkes için aynı.
export function navItemsFor(role: string | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV.filter((n) => n.roles.includes(role));
}
