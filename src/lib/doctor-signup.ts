// M5 Kayıt — yeni hekim hesabı oluşturma (e-posta kaydı + Google OAuth callback ortak kullanır).
// Doctor (verified:false → admin/etik kurul onayına kadar public dizin/eşleştirme KAPALI;
// onboardedAt/activatedAt null → /doktor/baslangic zorunlu kapısı) + bağlı User (DOCTOR). Atomik.
import { db } from "@/lib/db";

export interface DoctorSignupInput {
  name: string;
  email: string;        // benzersizlik çağıran tarafça önceden kontrol edilmeli
  passwordHash: string; // Google için rastgele hash (parola girişi devre dışı, alan zorunlu)
  title: string;
  branch: string;       // Doctor.branch ETİKET ("Kardiyoloji") — boş olabilir (Google yolu)
  city: string;
  languages: string;    // CSV ("Türkçe,İngilizce")
}

// Yeni hekim + bağlı kullanıcı oluşturur, oluşturulan User'ı döndürür.
export async function createDoctorAccount(input: DoctorSignupInput) {
  return db.$transaction(async (tx) => {
    const doctor = await tx.doctor.create({
      data: {
        name: input.name,
        title: input.title,
        branch: input.branch,
        city: input.city,
        languages: input.languages,
        verified: false, // küratörlü güven: self-signup hekim doğrulanmamış başlar
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
