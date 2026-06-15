# Canlı Tercüme POC — Gemini Live (gerçek zamanlı ses→ses)

Görüşmede hasta kendi dilinde konuşur, doktor anında **Türkçe sesli + altyazı** duyar (ve tersi).
Seçilen sağlayıcı: **Google Gemini Live API** — `gemini-3.5-live-translate-preview`
("düşük gecikmeli, gerçek zamanlı ses→ses çeviri", 70+ dil).

## Neden Gemini (C seçeneği)
Claude'un ses API'si yok. Gemini, **tam bu iş için** özel bir model çıkarmış (live-translate),
elle STT→çeviri→TTS zincirine gerek yok. OpenAI Realtime / Azure Speech Translation alternatifti;
Gemini live-translate fiyat + turnkey çeviri açısından öne çıktı.

## Fiyat (resmi, 2026-06)
| | Ses girişi | Ses çıkışı |
|---|---|---|
| 1M token | $3.50 | $21.00 |
| dakika | $0.0053 | $0.0315 |

- Tek yön ≈ **$0.037/dk**, çift yön ≈ **$0.074/dk** (25 token/sn)
- 20 dk görüşme: tek yön **~$0.74**, çift yön **~$1.47** (gerçekte daha düşük — kişi hep konuşmaz)
- İnsan tercüman $30-80/saat → AI ~50-100× ucuz. Pakette "tıbbi tercüman" kalemi = sağlıklı marj.
- ⚠️ Ücretsiz katman yok; `*-preview` model.

## Mimari (Vercel-uyumlu)
Vercel serverless kalıcı WebSocket tutamaz → **client-to-server + ephemeral token**:
1. Tarayıcı → `POST /api/realtime/token` (sunucu, GEMINI_API_KEY ile kısa ömürlü token üretir)
2. Tarayıcı → token'la doğrudan Gemini Live WebSocket'e bağlanır (ham anahtar tarayıcıya GİTMEZ)
3. Mic PCM **16kHz** gönderilir → çeviri sesi PCM **24kHz** + altyazı gelir
- Ephemeral token: `ai.authTokens.create({ config: { uses, expireTime, newSessionExpireTime, liveConnectConstraints } })`

## Durum
- ✅ **İskelet (bu commit):** `/api/realtime/token` (GET durum + POST mint; anahtarsız dormant) ·
  `LiveInterpreter` bileşeni görüşme odasında (durum + bağlantı testi) · `@google/genai` kuruldu · `.env.example`
- ⏳ **Sonraki adım (kullanıcı onayında):** gerçek ses akışı — mic yakalama (AudioWorklet, 16kHz),
  `ai.live.connect`, 24kHz çıkış oynatma + altyazı; tek yön → sonra çift yön
- 🔑 **Aktivasyon (kullanıcı):** Google AI Studio anahtarı → Vercel `GEMINI_API_KEY` (+ yerel `.env`) → redeploy

## Açık konular
- KVKK/GDPR: C'de hastanın **ham sesi** Google'a akar → DPA + aydınlatma metni (üretim öncesi)
- Kesin gecikme/kalite ölçümü gerçek anahtarla yapılacak (preview model)
