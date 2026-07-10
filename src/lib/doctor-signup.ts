// M5 Kayıt — yeni doktor hesabı oluşturma (e-posta kaydı + Google OAuth callback ortak kullanır).
// Doctor (verified:false → admin/etik kurul onayına kadar public dizin/eşleştirme KAPALI;
// onboardedAt/activatedAt null → /doktor/baslangic zorunlu kapısı) + bağlı User (DOCTOR). Atomik.
import { db } from "@/lib/db";
import { encryptField } from "@/lib/crypto";
import { verifyDoctorAgainstRegistry } from "@/lib/ht-registry";

export interface DoctorSignupInput {
  name: string;
  email: string;        // benzersizlik çağıran tarafça önceden kontrol edilmeli
  passwordHash: string; // Google için rastgele hash (parola girişi devre dışı, alan zorunlu)
  title: string;
  branch: string;       // Doctor.branch ETİKET ("Kardiyoloji") — boş olabilir (Google yolu)
  city: string;
  languages: string;    // CSV ("Türkçe,İngilizce")
  phone?: string | null; // cep telefonu (FAZ 5) — at-rest şifreli saklanır; WA/SMS bildirim hedefi
}

// Yeni doktor + bağlı kullanıcı oluşturur, oluşturulan User'ı döndürür.
// Kayıt sonrası HealthTürkiye dizin doğrulaması (FAZ 6) fire-safe koşulur: bulunamazsa
// Doctor.registryStatus=NOT_FOUND → /admin/hekim-onay onay kartında kırmızı uyarı bayrağı.
export async function createDoctorAccount(input: DoctorSignupInput) {
  const user = await createAccountTx(input);
  if (user.doctorId) await verifyDoctorAgainstRegistry(user.doctorId, input.name); // hata kayıt akışını bozmaz (içeride yutulur)
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
