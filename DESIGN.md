# Tasarım Sistemi — AURA (Telehealth + Sağlık Turizmi)

> Bu dosya görsel/UI kararlarının **tek doğruluk kaynağıdır**. Herhangi bir UI değişikliğinden
> önce okunur; sapılacaksa açık kullanıcı onayı gerekir. QA/inceleme modunda bu sisteme
> uymayan kod işaretlenir. `/design-consultation` (2026-06-23) ile mevcut AURA dilinden türetildi.

## Akılda kalan tek his (memorable thing)

**"Emin ellerdesin."** Sakin yetkinlik + güvenlik. Bağlayıcı kısıt **tıbbi güven**: hasta
kanser biyopsisini ve sınır ötesi PHI'sını bu platforma emanet ediyor. Her tasarım kararı
bu hisse hizmet eder; çelişiyorsa karar yanlıştır. Soğukkanlı, kesin, klinik-premium > sıcak/oyuncul.

## Ürün bağlamı

- **Ne:** Çok ülkeli sağlık turizmi + telehealth platformu (triyaj → görüşme → tedavi paketi →
  post-op + ikinci görüş + ücretsiz-hizmet + KVKK onam/paylaşım + FHIR).
- **Kim için:** Uluslararası hastalar (DZ, RU, DE, KZ, KG, AZ, GB, FR…), hekimler, koordinatörler,
  etik kurul. Çoğu endişeli, kimi yaşlı, kimi yavaş bağlantıda, çoğu ana dili dışında okuyor.
- **Tür:** Hibrit — kreatif-editoryal **pazarlama** (landing) + sakin **klinik uygulama** (workspace).

## Kategorinin temel gerilimi

İki zıt kuvvet **aynı anda** tutulur: **tıbbi güven** (klinik, güvenli, yetkin) ↔ **turizm
sıcaklığı** (davetkâr, premium misafirperverlik). Çözüm **yüzeye göre çift mod**: koyu dramatik
pazarlama + açık sakin klinik. "Emin ellerdesin" hissi nedeniyle terazi **güven** tarafına eğiktir.

## Estetik yön

- **Yön:** Editorial Calm (editoryal sakinlik).
- **Dekorasyon:** niyetli (intentional) — pazarlamada aura-glow atmosferi; klinikte neredeyse yok.
- **Mod:** "Dünya standardında bir kliniğin sakin yetkinliği." Premium, kesin, güven veren. Steril değil.
- **İki yüz, tek marka:** koyu pazarlama (`#0A0A0B`) / açık klinik (`#eef1f5`) — bilinçli ayrım,
  tutarlı uygulanır (yoksa "iki ayrı ürün" hissi doğar).

## Tipografi

- **Display / Hero:** **Space Grotesk** (500/700) — vitrin (aura-health.higgsfield.app) ile ortak
  display sesi; sıkı tracking (−0.02…−0.03em) ile sinematik. `--font-serif` değişken adı tarihseldir,
  display yuvası olarak kullanılır.
- **Gövde / UI:** **Inter** (variable) — yüksek okunur, nötr. `var(--font-sans)` ile uygulama geneli
  (`layout.tsx`); gövde min 16px.
- **Mikro / durak:** **JetBrains Mono** (`--font-mono`) — eyebrow, adım numarası (01…), istatistik
  etiketi, kart eyebrow'ları. Vitrindeki "mono durak" dilinin platform karşılığı.
- **Logo wordmark:** görsel varlık (aura-word-*.png, PortamedLogo) — font değil.
- **Data / tablo:** Inter + `tabular-nums` (klinik değer/fiyat hizası).
- **Çok dilli kapsam:** Inter **Kiril kapsar** (RU pazarı markalı) — Arapça hâlâ sistem fallback
  (bilinçli; Noto Sans Arabic yoldaş font kararı açık kalem). RTL ikon aynalaması (`[dir="rtl"]`) var.
- **Yükleme:** `next/font/google` (Space Grotesk + Inter + JetBrains Mono), `subsets: ["latin","latin-ext"]`.
- **Ölçek:** hero 42→62px (responsive) · bölüm başlık 30→38px · alt başlık 21–27px · gövde 15–18px ·
  yardımcı 12.5–14px · etiket/caption 11–12px. Satır yüksekliği gövdede ~1.6.

## Renk

- **Yaklaşım:** sınırlı (restrained) — tek marka aksanı (teal) + nötrler. Renk az ve anlamlı.
- **Marka / aksan (vitrin turkuazı):** turkuaz `#28C8D8` · derin/hover `#1FA9B8` · açık aura
  `#6FDCE8` · açık-zemin metin varyantı `#17919E`. (Kullanıcı logosunun rengi; vitrinle bire bir.)
  **Tek dekoratif renk budur.**
- **Koyu yüzeyler (gece — vitrinle ortak):** sayfa `#0D0E10` · bölüm bandı `#101113` ·
  panel `#161719` (kart, 22px radius) · yüzey `#1E1F22` (input/çip) · metin `#F4F5F3` /
  muted `rgba(255,255,255,.4–.72)`. Public + giriş/kayıt yüzeyi tamamen bu ailede (Faz A, 2026-07-11).
- **Açık yüzeyler (klinik — GEÇİŞ SÜRECİNDE):** zemin `#eef1f5` · kart `#FFFFFF` · metin `#1a1f29` /
  ikincil `slate-500`. Faz B/C'de iç paneller marka-hizalı koyuya taşınacak (klinik okunabilirlik
  önde, gece paleti + aynı fontlar); o zamana dek mevcut açık düzen geçerli.
- **Tersiyer (nadir):** altın `#C6A664` yalnız puan yıldızı.

### ⚠️ Tıbbi renk semantiği (en kritik kural)

Sağlık uygulamasında renk **klinik anlam taşır**. Aşağıdaki renkler **YALNIZ** klinik durum için
ayrılır; **dekoratif kullanılamaz** (dekoratif kırmızı ile alarm kırmızısı karışırsa tehlikelidir):

- **Emerald** (`#059669` / bg `#ECFDF5`): normal/iyi — ACTIVE paylaşım, RELEASED escrow, kırmızı bayrak NONE.
- **Amber** (`#F59E0B`): izle/beklemede — kırmızı bayrak WATCH, PENDING.
- **Red** (`#DC2626` / bg `#FEF2F2`): kritik/acil — kırmızı bayrak RED, REVOKED, iade, aciliyet 5.
  **Az kullan** (alarm yorgunluğu).
- **Slate** (nötr): pasif/süresi dolmuş.
- **Aciliyet 1–5 rampası:** 1 rutin (slate/teal) → 3 orta (amber) → 5 acil (red). Tek tutarlı rampa.

## Boşluk

- **Taban:** 4px (Tailwind). **Yoğunluk:** konforlu (compact DEĞİL) — kaygılı/yaşlı kullanıcı için nefes.
- **Ölçek:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout

- **Yaklaşım:** hibrit — kreatif-editoryal (pazarlama: asimetri, poster hero, grid-kırma) +
  sakin app-UI (klinik: grid-disiplinli, kart yalnız kartın kendisi etkileşimse).
- **Maks içerik genişliği:** pazarlama ~1320px; klinik içerik formuna göre dar.
- **Köşe yarıçapı:** sm 8px · md 12–14px · lg 16–20px · 2xl 24px · full 9999px (rozet/pill).
- **Klinikte kart enflasyonu yasak:** veri yoğun panelde dekoratif kart-mozaiği yok; sakin yüzey hiyerarşisi.

## Hareket

- **Yaklaşım:** yüzeye göre. **Pazarlama:** niyetli — aura-glow float (`auraFloat` 11–14s),
  hover/giriş. **Klinik:** minimal-fonksiyonel — tıbbi veride/durumda animasyon YOK (kaygı yaratır);
  yalnız anlamayı kolaylaştıran geçişler.
- **Easing:** giriş ease-out · çıkış ease-in · hareket ease-in-out.
- **Süre:** mikro 50–100ms · kısa 150–250ms · orta 250–400ms.
- **`prefers-reduced-motion`:** aura-glow dâhil dekoratif hareket kapanır.

## Erişilebilirlik (kural seviyesinde — kaygılı/yaşlı/ana-dili-değil kullanıcı)

- Gövde metni **≥16px**; düşük kontrast yasak (gövdede **≥4.5:1**).
- Dokunma hedefi **≥44px**.
- Ekran başına **tek karar** (triyaj sihirbazı deseni); happy-talk/talimat metni minimum.
- Placeholder tek başına etiket değildir; etiket alan doluyken görünür kalır.
- Tam klavye navigasyonu + ARIA landmark; RTL (Arapça/Farsça) kök kapsayıcıda `dir="rtl"`.
- Slow/3G bağlantıda zarif: ağır görsel yerine SVG art (PortamedArt deseni).

## Marka sesi (copy)

- Klinik yüzeylerde **fayda dili**: yönlendirme, durum, aksiyon. Mood/aspirasyon değil.
- Pazarlamada güven + sıcaklık; "her şey dahil", "yalnız değilsin", akredite.
- Tek ad: **AURA** (org-düzeyi "AIR" repo/altyapıda kalır, kullanıcı-görünür her yer AURA).
- "MVP demo" etiketleri yatırımcı/satış demosunda tutulur; simüle akışlar (ödeme) **açıkça** "simülasyon".

## Anti-slop (bu üründe asla)

Jenerik mavi + Inter/Roboto/system-ui gövde · 3-kolon ikon-daire grid · her şey ortalı · mor
gradyan · dekoratif kırmızı (semantikle çakışır) · klinik panelde dekoratif kart mozaiği ·
tıbbi veride gereksiz animasyon.

## Kararlar günlüğü

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-06-23 | DESIGN.md mevcut AURA dilinden oluşturuldu | `/design-consultation`; memorable-thing "Emin ellerdesin" (tıbbi güven öncelikli) |
| 2026-06-23 | Uygulama tipografisi landing'e çekildi (Hanken+Newsreader) | `layout.tsx`+`globals.css`; landing↔uygulama kalite uçurumu kapatıldı |
| 2026-07-11 | **Vitrin görsel diline geçiş (Faz A):** palet `#0D0E10`+`#28C8D8`, tipografi Space Grotesk+Inter+JetBrains Mono; public+giriş yüzeyi gece | Kullanıcı kararı — vitrin (aura-health.higgsfield.app) ile tek marka dili; iç paneller Faz B/C'de |
| (açık) | Arapça yoldaş font (Noto Sans Arabic) **veya** bilinçli sistem fallback | Inter Kiril'i kapattı; AR hâlâ markasız fallback'te |
