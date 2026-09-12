import { POST as doctoriumPost } from "@/app/api/doctorium/kvkk-basvuru/route";

// AURA KVKK m.11 başvuru ucu (kod Paket A, v6.268 · 2026-09-13) — Doctorium ucuyla AYNI işleyici: kütük `KvkkApplication`
// rol ve marka bağımsızdır (A07 madde B.2 "Doctorium ile ortak model"); yalnız oturumlu üye (hasta + personel), 5/saat/
// kullanıcı, audit + bildirim lib/kvkk-applications'ta. /kvkk-basvuru sayfasındaki AuraKvkkApplicationForm bu ucu çağırır;
// Doctorium formu /api/doctorium/kvkk-basvuru'yu. İki uç tek kod yolu — davranış ayrışırsa burada sarmalanır.
export async function POST(req: Request) {
  return doctoriumPost(req);
}
