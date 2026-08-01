import { permanentRedirect } from "next/navigation";

// "Haberler" → "Doctorium" (v6.48, kullanıcı kararı). Eski rota kalıcı yönlendirir:
// bant linki değişse de yer imi/eski bağlantı kırılmaz.
export default function HaberlerRedirect() {
  permanentRedirect("/doktor/doctorium");
}
