// Ably sunucu tarafı (P1 #6 Faz 2) — API anahtarı YALNIZ burada (Node); tarayıcıya asla verilmez.
// İki iş: (1) istemciye kanala-özel kısa token üret (token-auth), (2) sinyal mesajını Ably'ye yayınla.
// Anahtar yoksa her iki fonksiyon da güvenli no-op/null döner → uygulama DB-yolu ile çalışmaya devam eder
// (Ably tümüyle opsiyonel katman; kurulmadıysa mevcut polling backstop taşır).
import Ably from "ably";

// Sinyal kanalı adı — kanal kimliğinden türetilir. Ably capability + istemci abonesi bu adı kullanır.
export function signalChannel(channelId: string): string {
  return `sig:${channelId}`;
}

let restClient: Ably.Rest | null = null;
function rest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  if (!restClient) restClient = new Ably.Rest({ key });
  return restClient;
}

export function ablyConfigured(): boolean {
  return !!process.env.ABLY_API_KEY;
}

// İstemci için kanala-özel token isteği (createTokenRequest) — YALNIZ o kanala ABONE yetkisi.
// clientId = userId (Ably tarafında kimlik). Yayınlama sunucuda yapıldığından istemciye publish verilmez.
// Döner: JSON-serileştirilebilir TokenRequest (istemci Ably.Realtime authUrl'inden alır) veya null (anahtarsız).
export async function createAblyTokenRequest(userId: string, channelId: string): Promise<object | null> {
  const client = rest();
  if (!client) return null;
  return client.auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify({ [signalChannel(channelId)]: ["subscribe"] }),
    ttl: 60 * 60 * 1000, // 1 saat; Ably SDK bitmeden authUrl'den yeniler
  });
}

// Bir sinyal mesajını Ably kanalına yayınla (offer/answer/ice/bye — PHI DEĞİL). Transkript ASLA
// buraya gelmez (çağıran kind'i süzer). Best-effort: hata/anahtarsızsa sessizce geçer (DB yolu taşır).
// sender dahil → istemci kendi tarafının mesajını süzer (poll'daki sender!=me ile aynı semantik).
export async function publishSignal(
  channelId: string, msg: { id: number; kind: string; data: string; sender: string },
): Promise<void> {
  const client = rest();
  if (!client) return;
  try {
    await client.channels.get(signalChannel(channelId)).publish("signal", msg);
  } catch {
    // Ably yayını başarısız → istemcinin DB backstop poll'ü mesajı yine de teslim eder.
  }
}
