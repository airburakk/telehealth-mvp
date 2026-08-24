// M5 Kayıt — yeni doktor hesabı oluşturma (e-posta kaydı + Google OAuth callback ortak kullanır).
// Doctor (verified:false → admin/etik kurul onayına kadar public dizin/eşleştirme KAPALI;
// onboardedAt/activatedAt null → /doktor/baslangic zorunlu kapısı) + bağlı User (DOCTOR). Atomik.
import { db } from "@/lib/db";
import { encryptField } from "@/lib/crypto";
import { verifyDoctorAgainstRegistry } from "@/lib/ht-registry";

// Geçerli ünvanlar — e-posta kaydı + OAuth profil-tamamlama doğrulaması ortak kullanır.
// (Client formlardaki kopyalar ayrıdır: bu modül db import ettiğinden bundle'a giremez.)
export const DOCTOR_TITLES = ["Prof. Dr.", "Doç. Dr.", "Op. Dr.", "Uzm. Dr."] as const;

// Öğrenci hunisi ünvanı (v6.95) — DOCTOR_TITLES'a BİLİNÇLİ eklenmez: doktor kayıt formunda
// seçilemez; yalnız /api/auth/signup-student sabitler. Ünvan tanımlayıcıdır, kapı değildir
// (öğrenci modu Doctor.studentTrack'ten okunur — title'a bakan kapı yazma).
export const STUDENT_TITLE = "Tıp Öğr.";

export interface DoctorSignupInput {
  name: string;
  email: string;        // benzersizlik çağıran tarafça önceden kontrol edilmeli
  passwordHash: string; // Google için rastgele hash (parola girişi devre dışı, alan zorunlu)
  title: string;
  branch: string;       // Doctor.branch ETİKET ("Kardiyoloji") — boş olabilir (Google yolu)
  city: string;
  languages: string;    // CSV ("Türkçe,İngilizce")
  phone?: string | null; // cep telefonu (FAZ 5) — at-rest şifreli saklanır; WA/SMS bildirim hedefi
  studentTrack?: boolean; // v6.95 — /ogrenci hunisi: öğrenci-modu onboarding + registry atlanır
}

// Yeni doktor + bağlı kullanıcı oluşturur, oluşturulan User'ı döndürür.
// Kayıt sonrası HealthTürkiye dizin doğrulaması (FAZ 6) fire-safe koşulur: bulunamazsa
// Doctor.registryStatus=NOT_FOUND → /admin/doktor-onay onay kartında kırmızı uyarı bayrağı.
// v6.95: öğrenci hesabında dizin doğrulaması ATLANIR — öğrenci doktor dizininde olmaz;
// koşulsaydı her öğrenci hesabı yanlış NOT_FOUND bayrağıyla açılırdı.
export async function createDoctorAccount(input: DoctorSignupInput) {
  const user = await createAccountTx(input);
  if (user.doctorId && !input.studentTrack) await verifyDoctorAgainstRegistry(user.doctorId, input.name); // hata kayıt akışını bozmaz (içeride yutulur)
  return user;
}

function createAccountTx(input: DoctorSignupInput) {
  return db.$transaction(async (tx) => {
    const doctor = await tx.doctor.create({
      data: {
        name: input.name,
        title: input.title,
        branch: input.branch,
        city: input.city,
        languages: input.languages,
        phone: input.phone ? encryptField(input.phone) : null, // kişisel veri → at-rest şifreli
        verified: false, // küratörlü güven: self-signup doktor doğrulanmamış başlar
        studentTrack: input.studentTrack ?? false, // v6.95 — öğrenci hunisi işareti (erişim açmaz)
      },
    });
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "DOCTOR",
        doctorId: doctor.id,
      },
    });
    return user;
  });
}
