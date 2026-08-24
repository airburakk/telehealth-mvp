// Sosyal giriş dönüş banner'ı (v6.82) — /api/auth/{google,apple}/* rotaları forma
// `?oauth=<durum>&provider=<google|apple>` ile döner, metin burada tek yerden kurulur.
//
// Neden ortak fonksiyon: metin üç formda (hasta girişi, hasta kaydı, doktor kaydı) tekrarlıyordu ve
// hepsi sabit "Google" yazıyordu — Apple eklenince üçü de yanlış sağlayıcıyı söylerdi.
// ⚠️ Saf fonksiyon, "use client" modülünde DEĞİL: client bileşenlerinden import edilir (RSC dersi).

// provider parametresi olmayan eski bağlantılar Google'a düşer (geriye uyum).
export function oauthBannerMessage(
  reason: string | null,
  provider: string | null,
  action: "giriş" | "kayıt",
): string {
  const p = provider === "apple" ? "Apple" : "Google";
  switch (reason) {
    case "unavailable":
      return `${p} ile ${action} henüz yapılandırılmadı (yakında).`;
    case "error":
      return `${p} ile ${action} tamamlanamadı, lütfen tekrar deneyin.`;
    case "cancelled": // kullanıcı sağlayıcının onay ekranında vazgeçti — hata değil
      return `${p} ile ${action} iptal edildi.`;
    case "role": // Ayrışma (2026-08-24): Doctorium deploy'unda hasta hesabı içeri alınmaz
      return `Bu ${p} kimliği bir hasta hesabına bağlı. Doctorium, doktor ve tıp öğrencilerine özel bir çalışma alanıdır — hasta girişi için AURA'yı kullanın.`;
    default:
      return "";
  }
}
