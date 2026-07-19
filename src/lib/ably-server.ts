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
// channelName TAM kanal adıdır ("sig:<id>" | "live:<topic>") — önek çağıranda kurulur (token route).
// Döner: JSON-serileştirilebilir TokenRequest (istemci Ably.Realtime authUrl'inden alır) veya null (anahtarsız).
export async function createAblyTokenRequest(userId: string, channelName: string): Promise<object | null> {
  const client = rest();
  if (!client) return null;
  return client.auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify({ [channelName]: ["subscribe"] }),
    ttl: 15 * 60 * 1000, // 15 dk — logout-all (JWT iptali) sonrası kanal-dinleme penceresini daraltır; SDK bitmeden authUrl'den yeniler (iptal edilmiş oturumda yenileme 401 → abonelik düşer)
  });
}

// ── Canlı-durum dürtü kanalları (v6.28) ──────────────────────────────────────────────
// UI polling'i (bekleme odası / nöbet paneli / ücretsiz-bakım konsolu) için "şimdi yenile" dürtüsü.
// Olay İÇERİKSİZDİR: kanala hiçbir veri/PHI çıkmaz (yalnız zaman damgası) — veri daima auth'lu API
// fetch'iyle gelir (sinyalleşmedeki "transkript DB-only" kararıyla aynı ilke). Best-effort: Ably
// yok/hatalıysa sessizce geçer; istemcinin güvenlik-ağı polling'i durumu yine taşır.
export type LiveTopic = "free-care" | "duty";

export function liveChannel(topic: LiveTopic): string {
  return `live:${topic}`;
}

export async function publishLiveNudge(topic: LiveTopic): Promise<void> {
  const client = rest();
  if (!client) return;
  try {
    await client.channels.get(liveChannel(topic)).publish("nudge", { at: Date.now() });
  } catch {
    // yayın başarısız → istemci polling güvenlik ağı taşır
  }
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
