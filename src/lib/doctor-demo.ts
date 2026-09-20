// Demo doktor mu? (kontrol raporu 2026-09-19 D04) — sunucu yardımcısı (db okur).
//
// Gerçek profilde eksik mesleki bilgi ÜRETİLMEZ (okul/üyelik/yayın/odak cümlesi/örnek yorum); yalnız seed/demo
// profiller, açıkça "Demo profil" etiketiyle, render-üretimli zenginleştirmeyi kullanır. Şemada demo bayrağı YOK
// (migration istemez): gerçek doktor her zaman kayıt akışından geldiği için bağlı bir User hesabı ve gerçek bir
// e-postası vardır; seed doktorlarının ya hesabı yoktur ya da `*@air.test` demo hesabıdır. Lansmanda tüm
// seed/test kayıtları silinecek ([[prod-hesaplar-test-lansman-sifirlama]]) → bu sezgisel ayrım o güne kadar yeter.
import { db } from "./db";
import { isDemoDoctorAccount } from "./doctor-profile";

export async function doctorIsDemo(doctorId: string): Promise<boolean> {
  const account = await db.user.findFirst({ where: { doctorId }, select: { email: true } });
  return isDemoDoctorAccount(account?.email);
}
