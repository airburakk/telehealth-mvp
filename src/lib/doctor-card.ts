// Bekleme odası doktor özet kartı — tek kaynak veri derleyici (server).
// Atanan doktorun public profilinin (/hekim/[id]) ÖZETİNİ düz/serileştirilebilir bir objeye toplar,
// böylece client bileşeni (PreConsultLobby) bundle'a server-only modül çekmeden kartı çizebilir.
// Avatar değerleri (variant/cinsiyet) burada (server'da) türetilir → A3 doktor kartının bundle-safe deseni.

import { db } from "@/lib/db";
import {
  doctorCredentials, richBio, academicNote, avatarVariant, isFemaleName, type DoctorLike,
} from "@/lib/doctor-profile";
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
  successRate: number | null;
  languages: string[];
  bio: string;
  academic: string;
  badges: { key: string; label: string; desc: string }[];
  credentials: { diplomaSchool: string; diplomaYear: number | null; specBoard: string; specYear: number | null; certs: string[] };
}

// richBio/academicNote/credentials için gereken alanlar + kartın gösterdiği ek alanlar.
type DoctorRecord = DoctorLike & { bio: string | null; photo: string | null; successRate: number | null };

export async function buildDoctorCard(d: DoctorRecord): Promise<DoctorCardData> {
  const cred = doctorCredentials(d);
  const [badges, reviewCount] = await Promise.all([
    getDoctorBadges(d.id),
    db.review.count({ where: { doctorId: d.id } }),
  ]);
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
    successRate: d.successRate,
    languages: d.languages.split(",").map((s) => s.trim()).filter(Boolean),
    bio: richBio(d, d.bio),
    academic: academicNote(d),
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
