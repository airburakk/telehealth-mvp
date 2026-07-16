import { test, expect } from "@playwright/test";
import { loginAs, contextAs } from "./helpers";

// AKIŞ 2 — İkinci Görüş: hasta başvuru + ödeme → hasta vaka listesi → koordinatör kuyruğu.
//
// Kaynak eşlemesi (selektörler kaynaktan alındı, TAHMİN yok):
//  - Başvuru formu:   src/app/second-opinion/basvur/SoApplyForm.tsx
//  - Vaka detay/ödeme: src/app/second-opinion/vaka/[id]/SoCaseDetail.tsx
//  - Hasta listesi:   src/app/second-opinion/vakalarim/SoCasesList.tsx
//  - Koordinatör kuyruğu: src/app/operasyon/ikinci-gorus/page.tsx
//
// ── SELEKTÖR STRATEJİSİ (neden getByLabel KULLANILMAZ) ──
//  SoApplyForm'da <label> ile <select>/<textarea> arasında htmlFor/id BAĞI YOKTUR →
//  getByLabel(...) HİÇBİR alanı bulamaz (önceki başarısızlık: 60s timeout). Bu yüzden:
//   • Branş <select>: option value = BRANCHES[].key ("onkoloji") — çeviriden BAĞIMSIZ değişmez.
//     Select'i, KENDİNE ÖZGÜ bir option'ı (value="onkoloji") barındırdığı için içerikle hedefleriz
//     (DOM sırası/nth'e bağlı DEĞİL) → selectOption("onkoloji").
//   • Ülke <select>: option value = COUNTRIES[].code ("TR"). Görünen metin "🇹🇷 Türkiye" (bayrak+ad,
//     ÇEVRİLİR) — label EŞLEŞTİRME kırılgan; bu yüzden selectOption("TR") (value).
//   • Tanı: formdaki TEK <textarea> → getByRole("textbox") (placeholder çevrilir, güvenilmez).
//   • Gönder butonu: <main> içindeki TEK buton (header butonları <banner>'da) → çeviriden bağımsız.
//
// ── DURUM DETERMİNİZMİ (pay/route.ts) ──
//  DRAFT → (ödeme) → AWAITING_PAYMENT → PENDING_REVIEW → (CRM oto-atama) OFFERED. Ödeme sonrası
//  DURUM deterministik DEĞİL (oto-atama başarısına göre PENDING_REVIEW veya OFFERED). Bu yüzden durum
//  ETİKETİ sabitlenmez; vaka benzersiz TANI ÖZETİ (marker) ile listelerde/kuyrukta GÖRÜNDÜĞÜ doğrulanır.
//
// ── BELGE KAPISI ──
//  Her branşta EPICRISIS + IMAGING + MEDICATION_LIST zorunludur (data/second-opinion-docs.ts). Belge
//  yüklemeden ödemeye geçmek için "…sonra temin edeceğim" onay kutusu işaretlenmelidir; aksi halde
//  ödeme butonu disabled kalır (SoCaseDetail: payBlocked). Dosya/DICOM yükleme kırılgan/dış → parkedilir.
//
// ── DE-ID GÜVENLİĞİ (marker RAKAMSIZ olmalı) ──
//  deidentify.ts scrubText: 11 haneli sayı → [kimlik no], 10+ haneli dizi → [telefon], 1-2 harf+6-9
//  hane → [belge no]. Bu SO akışında diagnosisSummary ŞU AN scrub'dan geçmese de, marker'ı TAMAMEN
//  RAKAMSIZ tutmak testi de-id'e karşı dayanıklı kılar. Date.now() base36 → rakamlar harfe eşlenir.

// Date.now()'ı base36'ya çevir, sonra rakamları harflere eşle → tamamen RAKAMSIZ benzersiz alfa son ek.
// (0→g,1→h,…,9→p; base36'nın a-z harfleri zaten aralıkta.) scrubText'in hiçbir kuralına takılmaz.
function alphaSuffix(): string {
  const base36 = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return base36.replace(/[0-9]/g, (d) => String.fromCharCode(97 + 6 + Number(d))); // '0'→'g' … '9'→'p'
}

test("İkinci Görüş: başvuru + ödeme → hasta vakalarım → koordinatör kuyruğu", async ({ page, browser }) => {
  test.setTimeout(120_000); // çok-adımlı + oto-atama (CRM) + iki context → cömert bütçe.

  // Benzersiz + RAKAMSIZ tanı özeti → listelerde/kuyrukta tek ve kesin eşleşme, scrub'a takılmaz.
  const marker = `E2ESOMARKER${alphaSuffix()}`;
  const diagnosis = `${marker} sol meme invaziv duktal karsinom tanısı kondu; cerrahi öneriliyor.`;

  await test.step("Hasta giriş + başvuru formunu doldur", async () => {
    await loginAs(page, "Hasta");
    await page.goto("/second-opinion/basvur");

    // Form başlığı render oldu mu (SoApplyForm S.title — TR kanonik, Hasta TR olduğundan çevrilmez).
    await expect(page.getByRole("heading", { name: "Second Opinion Ön Değerlendirme" })).toBeVisible();

    // Branş <select> — value=key ("onkoloji"), çeviriden bağımsız. Select'i kendine özgü option'ıyla
    // içerikten hedefle (nth/DOM sırasına GÜVENME).
    const branchSelect = page.locator("select", { has: page.locator('option[value="onkoloji"]') });
    await branchSelect.selectOption("onkoloji");

    // Ülke <select> — value=code ("TR"). Görünen metin "🇹🇷 Türkiye" (çevrilir) → value ile seç.
    // Not: ülke seçimi UI dilini ülkenin birincil diline (TR→Türkçe) senkronlar; TR olduğundan TR kalır.
    const countrySelect = page.locator("select", { has: page.locator('option[value="TR"]') });
    await countrySelect.selectOption("TR");

    // Tanı / durum özeti — formdaki TEK <textarea> (comboboxlar textbox değildir). En az 10 karakter.
    await page.getByRole("textbox").fill(diagnosis);

    // Gönder — <main> içindeki TEK buton (header butonları <banner>'dadır). Metne bağlanmaz.
    // canSubmit tüm alanlar dolunca enable olur → önce enable'ı bekle, sonra tıkla.
    const submitBtn = page.getByRole("main").getByRole("button");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Başarıda /second-opinion/vaka/{id}'ye yönlenir.
    await page.waitForURL(/\/second-opinion\/vaka\/[^/]+$/, { timeout: 15_000 });
  });

  await test.step("Vaka DRAFT olarak açıldı + ödeme (belge park onayı ile)", async () => {
    // Vaka detay başlığı: "{branşLabel} · İkinci Görüş" (SoCaseDetail) — rol+desen (TR'de çevrilmez).
    await expect(page.getByRole("heading", { name: /İkinci Görüş/ })).toBeVisible();

    // Ödeme bölümü yalnız DRAFT'ta görünür. Zorunlu belge eksik → "sonra temin edeceğim" checkbox'ı
    // görünür (payBlocked). Sayfadaki TEK checkbox → rol ile hedefle (metin çevrilir, güvenilmez).
    const willProvide = page.getByRole("checkbox");
    await expect(willProvide).toBeVisible();
    await willProvide.check();

    // Öde ve gönder — buton metni `Öde ve gönder (600 USD)`; "USD" para-birimi kodu çeviride SABİT
    // kalır → belge-ekle "Ekle" butonundan güvenle ayırır. Checkbox işaretli olduğundan enable olmalı.
    const payBtn = page.getByRole("button", { name: /USD/ });
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // Ödeme sonrası router.refresh() ile DRAFT'tan çıkılır → ödeme butonu (USD) artık görünmez.
    // Deterministik onay: DRAFT ödeme bölümünün kaybolması (durum etiketine bağlanmadan).
    await expect(payBtn).toBeHidden({ timeout: 20_000 });
  });

  await test.step("Hasta 'İkinci Görüş Yolculuğum' listesinde yeni vaka görünür", async () => {
    await page.goto("/second-opinion/vakalarim");
    await expect(page.getByRole("heading", { name: "İkinci Görüş Yolculuğum" })).toBeVisible();

    // Yeni vaka satırı — benzersiz tanı özeti (marker) ile kesin eşleşme. diagnosisSummary listede
    // ÇEVRİLMEDEN, doğrudan render edilir (SoCasesList: {c.diagnosisSummary}) → marker aynen görünür.
    await expect(page.getByText(marker, { exact: false })).toBeVisible();
    // Durum etiketini (PENDING_REVIEW/OFFERED) SABİTLEMİYORUZ — oto-atama nedeniyle belirsiz.
  });

  await test.step("Koordinatör kuyruğunda vaka görünür", async () => {
    // Çok-rollü akış: koordinatör için YENİ izole context (çerez karışmaz).
    const coordPage = await contextAs(browser, "Koordinatör");
    try {
      await coordPage.goto("/operasyon/ikinci-gorus");
      // Kuyruk başlığı server-component'te sabit (çeviri yok).
      await expect(coordPage.getByRole("heading", { name: "İkinci Görüş — Kuyruk" })).toBeVisible();

      // Vaka kuyrukta marker ile görünür — diagnosisSummary burada da ÇEVRİLMEDEN render edilir
      // (SoQueuePage: {c.diagnosisSummary}); notIn CLOSED/CANCELLED → PENDING_REVIEW/OFFERED listelenir.
      await expect(coordPage.getByText(marker, { exact: false })).toBeVisible({ timeout: 15_000 });
    } finally {
      await coordPage.context().close();
    }
  });
});
