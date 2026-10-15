// Header'ın sağ yuvası ÜÇ durumludur (2026-10-10 hata düzeltmesi). Oturum bilgisi P0-3'ten beri
// istemcide /api/auth/me'den gelir (bkz. AppChrome); yanıt dönene kadar "bilinmiyor" ile "oturum
// yok" AYNI değildir. Eskiden ikisi de `user: null` idi → her tam sayfa yüklemesinde giriş yapmış
// doktor yüzlerce ms "○ Giriş yap" görüyordu (yavaş içtihat aramasından sonra fark edildi).
//   pending → yanıt bekleniyor: avatar boyutunda boş yuva (yanıltıcı giriş bağlantısı YOK)
//   account → kullanıcı var: avatar + hesap menüsü
//   guest   → yanıt geldi (ya da istek düştü) ve kullanıcı yok: "Giriş yap" + tema anahtarı
export type HeaderAuthSlot = "pending" | "account" | "guest";

export function headerAuthSlot(user: unknown, resolved: boolean): HeaderAuthSlot {
  if (user) return "account";
  return resolved ? "guest" : "pending";
}
