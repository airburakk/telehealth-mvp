import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { decryptField } from "@/lib/crypto";

// GET /api/patient/profile — profil hafızası (basitleştirme Faz 1 prefill): hastanın kayıtlı
// ad/ülke/dil/telefon/iletişim tercihi. Yalnız hesap sahibi HASTA okur (kendi verisi; telefon
// at-rest şifreli → burada sahibine çözülerek döner). Yazım yok — profil intake yaz-geri ile
// dolar (lib/patient-journey stampPatientProfile).
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "PATIENT") {
    return NextResponse.json({ error: "Bu uç yalnız hasta hesabıyla kullanılabilir." }, { status: 403 });
  }
  const u = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true, patientCountry: true, patientLanguage: true, patientPhone: true, patientContactPref: true },
  });
  if (!u) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  return NextResponse.json({
    name: u.name,
    country: u.patientCountry,
    language: u.patientLanguage,
    phone: u.patientPhone ? decryptField(u.patientPhone) : null,
    contactPref: u.patientContactPref,
  });
}
