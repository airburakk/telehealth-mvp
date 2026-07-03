// Hasta self-signup — yeni hasta hesabı oluşturma (e-posta kaydı + Google OAuth callback ortak kullanır).
// Doktor kaydının aksine profil tablosu yoktur: yalnız User (role=PATIENT). Onam (KVKK) girişten
// sonra proxy kapısıyla alınır (cv=0 → /onam).
import { db } from "@/lib/db";

export interface PatientSignupInput {
  name: string;
  email: string;        // benzersizlik çağıran tarafça önceden kontrol edilmeli
  passwordHash: string; // Google için rastgele hash (parola girişi devre dışı, alan zorunlu)
}

export async function createPatientAccount(input: PatientSignupInput) {
  return db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      role: "PATIENT",
    },
  });
}
