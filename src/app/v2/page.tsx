import { permanentRedirect } from "next/navigation";

// /v2 → / (taşıma 2026-07-16): önizleme dönemi bitti, V2 ana sayfa oldu.
// Rota SİLİNMEDİ, kalıcı redirect: önizleme döneminde paylaşılan/işaretlenen
// /v2 bağlantıları kırılmasın. noindex zaten vardı → indekste izi yok.
export default function V2Page() {
  permanentRedirect("/");
}
