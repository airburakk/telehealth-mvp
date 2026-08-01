import { redirect } from "next/navigation";

// v6.49: branş tercihleri ayrı sayfa olmaktan çıkıp modül sekmelerinin ALTINA alt menü oldu
// (kullanıcı isteği). Rota, tek bir doğru yer kalsın diye yönlendirmeye indirildi — iki ayrı
// tercih ekranı zamanla sürüklenirdi.
export default function TercihlerRedirect() {
  redirect("/doktor/doctorium");
}
