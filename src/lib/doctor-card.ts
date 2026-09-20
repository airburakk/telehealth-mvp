// Bekleme odası doktor özet kartı — tek kaynak veri derleyici (server).
// Atanan doktorun public profilinin (/doktorlar/[id]) ÖZETİNİ düz/serileştirilebilir bir objeye toplar,
// böylece client bileşeni (PreConsultLobby) bundle'a server-only modül çekmeden kartı çizebilir.
// Avatar değerleri (variant/cinsiyet) burada (server'da) türetilir → A3 doktor kartının bundle-safe deseni.

import { db } from "@/lib/db";
import {
  doctorCredentials, richBio, academicNote, avatarVariant, isFemaleName, type DoctorLike,
} from "@/lib/doctor-profile";
import { doctorIsDemo } from "@/lib/doctor-demo";
import { getDoctorBadges } from "@/lib/match-score";

export interface DoctorCardData {
  id: string;
  title: string;
  name: string;
  branch: string;
  city: string;
  photo: string | null;
  avatarVariant: number;
  female: boolean;
  verified: boolean;
  // v4.19 veri dürüstlüğü: null = "veri yok" → tüketici (PreConsultLobby vb.) o satırı GİZLER (0/uydurma göstermek yasak)
  jci: boolean | null;
  rating: number | null;
  reviewCount: number;
  experienceYears: number | null;
  // successRate KALDIRILDI (D04, kontrol raporu 2026-09-19): tanım/örneklem/dönem/doğrulama yöntemi olmayan oran hasta yüzünde gösterilmez.
  languages: string[];
  /** Demo/seed profil (üretilmiş zenginleştirme) — tüketici "Demo profil" etiketi basar. */
  demo: boolean;
  bio: string;
  academic: string | null; // null = gerçek profilde akademik bilgi eklenmemiş (üretilmez)
  badges: { key: string; label: string; desc: string }[];
  credentials: { diplomaSchool: string | null; diplomaYear: number | null; specBoard: string | null; specYear: number | null; certs: string[] };
}

// richBio/academicNote/credentials için gereken alanlar + kartın gösterdiği ek alanlar.
type DoctorRecord = DoctorLike & { bio: string | null; photo: string | null };

export async function buildDoctorCard(d: DoctorRecord): Promise<DoctorCardData> {
  const [badges, reviewCount, demo] = await Promise.all([
    getDoctorBadges(d.id),
    db.review.count({ where: { doctorId: d.id } }),
    doctorIsDemo(d.id),
  ]);
  const mode = { demo };
  const cred = doctorCredentials(d, mode);
  return {
    id: d.id,
    title: d.title,
    name: d.name,
    branch: d.branch,
    city: d.city,
    photo: d.photo,
    avatarVariant: avatarVariant(d.name),
    female: isFemaleName(d.name),
    verified: d.verified,
    jci: d.jci,
    rating: d.rating,
    reviewCount,
    experienceYears: d.experienceYears,
    languages: d.languages.split(",").map((s) => s.trim()).filter(Boolean),
    demo,
    bio: richBio(d, d.bio, mode),
    academic: academicNote(d, mode),
    badges: badges.map((b) => ({ key: b.key, label: b.label, desc: b.desc })),
    credentials: {
      diplomaSchool: cred.diploma.school,
      diplomaYear: cred.diploma.year,
      specBoard: cred.uzmanlik.board,
      specYear: cred.uzmanlik.year,
      certs: cred.certs,
    },
  };
}
