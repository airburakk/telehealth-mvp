import { test, expect } from "@playwright/test";
import { loginAs, contextAs, expectNotVisible } from "./helpers";

// AKIŞ 1 — Hasta triyaj → vaka → doktor kokpit → görüşme odası.
//
// Kapsam (deterministik):
//   1) Hasta: ön-konsültasyon ödeme kapısı (sigortasız/demo ödeme) → triyaj sihirbazı
//      (Hasta → Şikayet → Branş Soruları → Belgeler → Özet) → "Başvuruyu oluştur" → sonuç sayfası.
//   2) Doktor: yeni izole context → doktor kokpit (Vaka Kuyruğu) → vakayı ada göre bul →
//      vaka detayı → "Görüşmeyi Başlat" → görüşme odasının (PreConsultLobby) RENDER'ı.
//
// Kırılgan/dış bağımlılıklar (DENENMEZ):
//   • AI triyaj (Claude): yavaş olabilir / ANTHROPIC_API_KEY yoksa kural-fallback → cömert timeout,
//     sonuç içeriği (branş/aciliyet) assert EDİLMEZ; yalnız akışın ilerlediği doğrulanır.
//   • WebRTC P2P el sıkışması: sahte medya cihazı ile lobi/oda RENDER olur; iki-uç bağlantı DENENMEZ.
//
// LOCALE UYARISI (bu spec'in düşme sebebi):
//   • Demo Hasta hesabı Cezayir/Arapça taşır → hasta-yüzlü sayfalar (triyaj sonucu dahil) SUNUCUDA
//     Arapçaya çevrilir. Ayrıca sonuç sayfası, branşta çevrimiçi doktor yoksa "Başvurunuz oluşturuldu"
//     yerine 3-seçenek YÖNLENDİRME kapısını (ConsultGate) gösterir. Bu iki gerçek yüzünden sonuç
//     adımında ÇEVRİLEBİLİR/DURUMA-BAĞLI metne (başlık) assert BAĞLANMAZ. Deterministik + locale-bağımsız
//     çıpa = URL /triyaj/[id] + her iki görünümde de basılan VAKA-REF token'ı (id.slice(0,8).toUpperCase()).
//   • Doktor tarafı sayfalar (/doktor, /doktor/vaka/[id]) sunucu-render + TR-sabit metinlidir (çeviri yok);
//     görüşme lobisi doktor için lang="Türkçe" ile açılır (useT no-op) → lobi başlıkları TR-sabit → güvenli.

// Vakayı doktor kuyruğunda benzersiz bulabilmek için HARF-YALNIZ (rakamsız) benzersiz marker.
// NEDEN rakam yok: de-id scrubText PHONE_RE (/\+?\d[\d\s().-]{8,}\d/) 10+ rakam dizisini "[telefon]"
// olarak maskeler → Date.now() (13 hane) marker'ı bozar. base36'yı harfe indirger + rastgele harf ekleriz.
const uniqSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  .replace(/[^a-z]/g, "") // yalnız harf bırak (rakamsız → de-id güvenli)
  .toUpperCase()
  .slice(0, 10)
  .padEnd(6, "X"); // her koşulda ≥6 harf (arama/eşleşme için yeterince ayırt edici)
const patientName = `E2E Test ${uniqSuffix}`;
const symptomText =
  "Babamda akciğer kanseri şüphesi var, biyopsi sonucu çıktı, ikinci görüş için uzman değerlendirmesi istiyoruz.";

// İki-rol + AI + çok-adım akış → cömert toplam timeout.
test.setTimeout(150_000);

test("hasta triyaj → vaka oluşturma → doktor kokpit → görüşme odası render", async ({ page, browser }) => {
  // ── 1) HASTA: giriş + triyaj sayfası ──
  await test.step("Hasta giriş yapar ve triyaj sayfasını açar", async () => {
    await loginAs(page, "Hasta");
    await page.goto("/triyaj");
    // Triyaj her zaman önce ön-konsültasyon kapısıyla açılır (billing yokken).
    await expect(page.getByRole("heading", { name: "Uzman görüşmesi — ön bilgilendirme" })).toBeVisible();
  });

  // ── 2) HASTA: ön-konsültasyon ödeme kapısını deterministik şekilde geç (sigortasız → demo ödeme) ──
  await test.step("Ön-konsültasyon ödeme kapısı geçilir (sigortasız demo ödeme)", async () => {
    // info → insurance
    await page.getByRole("button", { name: "Devam et" }).click();
    await expect(page.getByRole("heading", { name: "Sigorta durumu" })).toBeVisible();
    // insurance → payment (sigortasız yol; poliçe doğrulama/sim ödeme kırılganlığını atlar)
    await page.getByRole("button", { name: /Hayır \/ sigortasız devam/ }).click();
    await expect(page.getByRole("heading", { name: "Ödeme", exact: true })).toBeVisible();
    // Demo kart numarası (>=12 hane) → "öde". Ödeme simülasyonu setTimeout(1300) → billing set edilir.
    await page.getByPlaceholder("Kart numarası").fill("4242424242424242");
    // Buton etiketi "$<fee> öde" biçiminde → "öde" alt-metniyle eşle.
    await page.getByRole("button", { name: /öde/ }).click();
    // Ödeme temizlenince triyaj sihirbazının başlığı görünür (kapı kapanır).
    await expect(page.getByRole("heading", { name: "Triyaj · Ön Değerlendirme" })).toBeVisible({ timeout: 15_000 });
  });

  // ── 3) HASTA: triyaj sihirbazı (5 adım) ──
  await test.step("Adım 0 — Hasta: ad girilir", async () => {
    await page.getByPlaceholder("Örn. Karim B.").fill(patientName);
    await page.getByRole("button", { name: /^Devam$/ }).click();
  });

  await test.step("Adım 1 — Şikayet: semptom girilir (AI ön analizi tetiklenir)", async () => {
    await page.getByPlaceholder(/Örn\. Babamda akciğer kanseri şüphesi/).fill(symptomText);
    // "Devam" → next() runAnalyze() çağırır (AI branş belirleme, yavaş olabilir).
    await page.getByRole("button", { name: /^Devam$/ }).click();
  });

  await test.step("Adım 2 — Branş Soruları: AI branş belirlemesini bekle, ilerle", async () => {
    // Branş yönlendirmesi (AI/kural) tamamlanınca "Yönlendirilen branş" kartı belirir → cömert timeout.
    // AI yavaşsa/atlanırsa spinner metni ("AI sizi doğru branşa yönlendiriyor…") görünebilir; branş
    // gelene kadar bekle. Branş kartını doğrulamak zorunlu değil; asıl amaç akışın ilerlemesi.
    await expect(page.getByText("Yönlendirilen branş")).toBeVisible({ timeout: 45_000 }); // LIVE-ITERATE: AI süresi ortama göre; branş kartı gelmezse "Devam"a doğrudan geç
    await page.getByRole("button", { name: /^Devam$/ }).click();
  });

  await test.step("Adım 3 — Belgeler: opsiyonel adım atlanır", async () => {
    // Belge yüklemek opsiyonel → doğrudan ilerle (dosya yükleme kırılganlığından kaçın).
    await expect(page.getByText("Belge yüklemek opsiyoneldir; bu adımı atlayabilirsiniz.")).toBeVisible();
    await page.getByRole("button", { name: /^Devam$/ }).click();
  });

  await test.step("Adım 4 — Özet: vaka oluşturulur", async () => {
    // Özet adımı Özet'e geçerken tekrar runAnalyze çağırır (analyzing spinner olabilir).
    // "Başvuruyu oluştur" butonu görünür olmalı; eksik zorunlu belge onayı bu senaryoda gerekmez
    // (belge işaretlenmedi → missingRequired branşa göre değişebilir).
    const createBtn = page.getByRole("button", { name: "Başvuruyu oluştur" });
    await expect(createBtn).toBeVisible({ timeout: 45_000 });
    // LIVE-ITERATE: bazı branşlarda zorunlu belge (*) işaretlenmediğinde buton disabled kalır ve
    // "Bu belgeleri görüşmeden önce ileteceğimi onaylıyorum." onayı gerekir. Gerekirse önce onayla:
    if (await createBtn.isDisabled()) {
      await page.getByText("Bu belgeleri görüşmeden önce ileteceğimi onaylıyorum.").click();
    }
    await createBtn.click();
  });

  // Vaka-ref token'ı: URL'deki case id'nin ilk 8 karakteri, büyük harf (sonuç sayfası "Başvuru No" kartında
  // c.id.slice(0,8).toUpperCase() ile aynı biçimde basılır). Bir KOD'dur → çevrilmez, de-id maskelemez
  // (cuid harf+rakam karışık, 10+ ardışık rakam içermez) → hem gate hem gate-siz görünümde deterministik.
  let caseRefToken = "";

  await test.step("Sonuç: vaka oluştu → /triyaj/[id] + locale-bağımsız vaka-ref çıpası", async () => {
    // submit() başarıda router.push(`/triyaj/${id}`) → sonuç sayfası.
    await page.waitForURL(/\/triyaj\/[^/]+$/, { timeout: 30_000 });
    const caseId = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(caseId.length).toBeGreaterThan(8); // cuid → id gerçekten oluştu
    caseRefToken = caseId.slice(0, 8).toUpperCase();

    // Sonuç sayfası HASTA DİLİNDE (Arapça) render olur ve branşta çevrimiçi doktor yoksa "Başvurunuz
    // oluşturuldu" başlığı yerine 3-seçenek YÖNLENDİRME kapısı (ConsultGate) çıkar. Bu yüzden ÇEVRİLEBİLİR
    // /DURUMA-BAĞLI başlığa DEĞİL, her iki görünümde de basılan (ve çevrilmeyen) vaka-ref KODUNA assert et.
    await expect(page.getByText(caseRefToken, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    // NOT: Hasta adı sonuç kartında Arapça-bağlamda ("المريض E2E Test …") geçtiği için ada göre değil,
    // yukarıdaki URL + vaka-ref token ile doğrulandı (locale-bağımsız).
  });

  // ── 4) DOKTOR: yeni izole context (çerez karışmasın) → kokpit ──
  const doctorPage = await contextAs(browser, "Doktor");
  await test.step("Doktor kokpiti açılır (Vaka Kuyruğu görünür)", async () => {
    // loginAs Doktor sonrası ana sayfaya yönlenir; kokpite git.
    await doctorPage.goto("/doktor");
    // LIVE-ITERATE: seed doktoru onboarding/aktivasyon kapısında ise `/doktor/baslangic`'e redirect
    // olabilir (activatedAt yok). O durumda kuyruğa ulaşmak için önce onboarding tamamlanmalı.
    // Doktor sayfası sunucu-render + TR-sabit metinli → başlık locale-bağımsız.
    await expect(doctorPage.getByRole("heading", { name: "Doktor Ana Sayfası" })).toBeVisible({ timeout: 20_000 });
  });

  await test.step("Yeni vaka doktor kuyruğunda görünür", async () => {
    // CaseQueue "Hasta ara…" kutusuyla ada göre filtrele (branş eşleşmesine bağlı kalmadan bul).
    // Placeholder TR-sabit (CaseQueue client bileşeni çeviri kullanmaz).
    await doctorPage.getByPlaceholder("Hasta ara…").fill(patientName);
    // Vaka satırı hasta adını taşır (patientName decryptField ile çözülür → düz metin marker). Cömert
    // timeout: AI fallback/senkron ortama göre değişebilir; vaka triyajdan hemen sonra kuyruğa düşer.
    // Seed doktoru Mehmet=Onkoloji; oluşan vaka Onkoloji → branş eşleşir → kuyrukta çıkar.
    const caseLink = doctorPage.getByRole("link", {
      name: new RegExp(patientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    });
    await expect(caseLink.first()).toBeVisible({ timeout: 30_000 }); // LIVE-ITERATE: vaka branşı doktor branşıyla eşleşmezse kuyrukta çıkmayabilir → gerekirse Koordinatör context'i (tüm kuyruk) kullan
    await caseLink.first().click();
  });

  await test.step("Vaka detayı açılır ve görüşme başlatılır", async () => {
    await doctorPage.waitForURL(/\/doktor\/vaka\/[^/]+$/, { timeout: 20_000 });
    // Kokpit vaka kartında hasta adı başlık (<h1>{c.patientName}</h1>) olarak görünür (TR-sabit sayfa).
    await expect(doctorPage.getByRole("heading", { name: patientName })).toBeVisible({ timeout: 15_000 });
    // Aksiyon panelindeki başlat butonu: yeni vakada "Görüşmeyi Başlat" (IN_CONSULT'ta "Görüşmeye Dön").
    const startBtn = doctorPage.getByRole("button", { name: /Görüşmeyi Başlat|Görüşmeye Dön/ });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    // StartConsultButton POST /api/cases/:id/consult → router.push(`/gorusme/:consultId`).
    await doctorPage.waitForURL(/\/gorusme\/[^/]+$/, { timeout: 30_000 });
  });

  await test.step("Görüşme odası (bekleme odası) RENDER olur — WebRTC el sıkışması denenmez", async () => {
    // /gorusme/[id] aktif görüşmede önce PreConsultLobby ("Görüşmeye hazırlanın") ile açılır.
    // Doktor görünümünde lobi lang="Türkçe" ile render olur (useT no-op) → başlıklar TR-sabit.
    // Sahte medya cihazı config'te (playwright.config.ts) → getUserMedia izin diyaloğunda asılmaz.
    await expect(doctorPage.getByRole("heading", { name: "Görüşmeye hazırlanın" })).toBeVisible({ timeout: 20_000 });
    // Cihaz testi bölümü (<h2>) + Katıl düğmesi = odanın kontrol UI'sinin render'ı (deterministik kanıt).
    await expect(doctorPage.getByRole("heading", { name: "Cihaz testi" })).toBeVisible();
    await expect(doctorPage.getByRole("button", { name: "Görüşmeye katıl" })).toBeVisible();
    // NOT: "Görüşmeye katıl"a basıp ConsultationRoom'a girmek (P2P/WebRTC) DENENMEZ — kırılgan.
  });

  await test.step("De-id kontrolü: doktor lobisinde hasta klinik semptom metni sızmaz", async () => {
    // Bekleme odası cihaz-testi/hazırlık ekranıdır; hastanın serbest-metin şikayeti burada
    // görünmemeli (klinik içerik odaya/kokpite ait, lobiye değil).
    await expectNotVisible(doctorPage, symptomText);
  });

  await doctorPage.context().close();
});
