import { permanentRedirect } from "next/navigation";

/**
 * v6.120 — Doctorium "Kongre" modülü "Etkinlik" oldu; detay rotası
 * /doktor/doctorium/kongre/[id] → /doktor/doctorium/etkinlik/[id] taşındı.
 *
 * Bu sayfa yalnız 308 yönlendirmedir. Neden `next.config.ts` redirects() DEĞİL:
 * next.config.ts paylaşılan bir dosya (CSP, başlıklar, WASM tracing) ve paralel oturumlar
 * aynı depoda çalışıyor — tek satırlık bir yönlendirme için o dosyaya girmek çakışma riski
 * yaratırdı. Rota-yerel yönlendirme aynı 308'i verir, hiçbir ortak dosyaya dokunmaz.
 *
 * ⚠️ SİLME: doktorlara gönderilmiş kongre alarmı bildirimlerinde bu adres yaşıyor
 * (lib/congress-reminder.ts eski href'leri), yer imleri ve paylaşılan bağlantılar da öyle.
 */
export default async function EskiKongreDetayi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/doktor/doctorium/etkinlik/${id}`);
}
