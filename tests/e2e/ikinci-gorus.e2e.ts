import { test, expect } from "@playwright/test";
import { loginAs, contextAs, expectNotVisible } from "./helpers";

// AKIŞ 2 — İkinci Görüş: hasta başvuru + ödeme → hasta vaka listesi → koordinatör kuyruğu.
//
// Kaynak eşlemesi (selektörler kaynaktan alındı, TAHMİN yok):
//  - Başvuru formu:   src/app/second-opinion/basvur/SoApplyForm.tsx
//  - Vaka detay/ödeme: src/app/second-opinion/vaka/[id]/SoCaseDetail.tsx
//  - Hasta listesi:   src/app/second-opinion/vakalarim/SoCasesList.tsx
//  - Koordinatör kuyruğu: src/app/operasyon/ikinci-gorus/page.tsx
//
// Akış notu (pay/route.ts): DRAFT → (ödeme) → AWAITING_PAYMENT → PENDING_REVIEW → (CRM oto-atama)
// OFFERED. Yani ödeme sonrası vakanın DURUMU deterministik değildir (oto-atama başarısına bağlı
// PENDING_REVIEW veya OFFERED olabilir). Bu yüzden testte durum ETİKETİ sabitlenmez; vakanın
// tanı özeti (benzersiz) ile listelerde/kuyrukta GÖRÜNDÜĞÜ doğrulanır.
//
// Her branşta EPICRISIS + IMAGING + MEDICATION_LIST zorunludur (data/second-opinion-docs.ts);
// belge yüklemeden ödemeye geçmek için "…sonra temin edeceğim" onay kutusu işaretlenmelidir,
// aksi halde ödeme butonu disabled kalır (SoCaseDetail: payBlocked).

test("İkinci Görüş: başvuru + ödeme → hasta vakalarım → koordinatör kuyruğu", async ({ page, browser }) => {
  // Benzersiz tanı özeti → listelerde/kuyrukta tek ve kesin eşleşme sağlar.
  const marker = `E2E-SO-${Date.now()}`;
  const diagnosis = `${marker} 3 ay önce sol meme invaziv duktal karsinom tanısı kondu; cerrahi öneriliyor.`;

  await test.step("Hasta giriş + başvuru formunu doldur", async () => {
    await loginAs(page, "Hasta");
    await page.goto("/second-opinion/basvur");

    // Form başlığı render oldu mu (SoApplyForm S.title).
    await expect(page.getByRole("heading", { name: "Second Opinion Ön Değerlendirme" })).toBeVisible();

    // Branş seçimi — <select> (S.branchLabel etiketli). Değerler lib/triage BRANCHES.label.
    await page.getByLabel("İlgili tıbbi branş").selectOption({ label: "Onkoloji" });
    // Ülke seçimi — <select> (S.countryLabel). Değer lib/constants COUNTRIES.name.
    // Not: option metni "🇹🇷 Türkiye" (bayrak + ad) — label eşleşmesi kırılgan olabilir.
    // LIVE-ITERATE: bayrak/label eşleşmesi tutmazsa değere göre seç → selectOption("TR").
    await page.getByLabel("Ülkeniz").selectOption("TR");

    // Tanı / durum özeti — textarea (S.diagLabel). En az 10 karakter gerekir (canSubmit).
    await page.getByLabel("Mevcut tanınız / durumunuz").fill(diagnosis);

    // Gönder — "Devam et — belge yükleme" (S.submit). Başarıda /second-opinion/vaka/{id}'ye yönlenir.
    await page.getByRole("button", { name: "Devam et — belge yükleme" }).click();
    await page.waitForURL(/\/second-opinion\/vaka\/[^/]+$/, { timeout: 15_000 });
  });

  await test.step("Vaka DRAFT olarak açıldı + ödeme (belge park onayı ile)", async () => {
    // Vaka detay başlığı: "{branşLabel} · İkinci Görüş" (SoCaseDetail).
    await expect(page.getByRole("heading", { name: /Onkoloji · İkinci Görüş/ })).toBeVisible();

    // Ödeme bölümü yalnız DRAFT'ta görünür (S.payTitle).
    await expect(page.getByText("Ödeme ve gönderim")).toBeVisible();

    // Zorunlu belgeleri yüklemedik → önce "sonra temin edeceğim" kutusunu işaretle
    // (S.willProvide), yoksa ödeme butonu disabled (payBlocked). Belge yükleme (dosya/DICOM)
    // dış/kırılgan olduğu için deterministik park yolu tercih edilir.
    await page
      .getByLabel("Eksik zorunlu belgeleri sonra temin edeceğim.")
      .check();

    // Öde ve gönder — "Öde ve gönder (600 USD)" (S.payBtn = `Öde ve gönder (${SO_FEE_USD} USD)`).
    const payBtn = page.getByRole("button", { name: "Öde ve gönder (600 USD)" });
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // Ödeme sonrası: router.refresh() ile durum ilerler (DRAFT ödeme bölümü kaybolur).
    // Deterministik onay: ödeme bölümü artık görünmez (DRAFT'tan çıkıldı).
    // LIVE-ITERATE: refresh gecikirse süreyi artır ya da "Ödemeniz alındı." banner'ını (S.paid) bekle.
    await expect(page.getByText("Ödeme ve gönderim")).toBeHidden({ timeout: 15_000 });
  });

  await test.step("Hasta 'İkinci Görüş Vakalarım' listesinde yeni vaka görünür", async () => {
    await page.goto("/second-opinion/vakalarim");
    await expect(page.getByRole("heading", { name: "İkinci Görüş Vakalarım" })).toBeVisible();

    // Yeni vaka satırı — benzersiz tanı özeti ile kesin eşleşme (line-clamp ama metin DOM'da).
    await expect(page.getByText(diagnosis, { exact: false })).toBeVisible();
    // Branş etiketi de listede yer alır (SoCasesList: t(c.branchLabel)).
    await expect(page.getByText("Onkoloji", { exact: false }).first()).toBeVisible();
    // Durum etiketini (PENDING_REVIEW/OFFERED) SABİTLEMİYORUZ — oto-atama nedeniyle belirsiz.
    // LIVE-ITERATE: oto-atama kapalıysa durum "Dosyanız incelenmeye alındı" (PENDING_REVIEW) olur.
  });

  await test.step("Koordinatör kuyruğunda vaka görünür", async () => {
    // Çok-rollü akış: koordinatör için YENİ izole context (çerez karışmaz).
    const coordPage = await contextAs(browser, "Koordinatör");
    try {
      await coordPage.goto("/operasyon/ikinci-gorus");
      await expect(coordPage.getByRole("heading", { name: "İkinci Görüş — Kuyruk" })).toBeVisible();

      // Vaka, kuyrukta tanı özeti ile görünür (SoQueuePage: notIn CLOSED/CANCELLED → OFFERED de listelenir).
      await expect(coordPage.getByText(diagnosis, { exact: false })).toBeVisible({ timeout: 15_000 });
      // Branş etiketi kuyrukta da yer alır (branchLabel).
      await expect(coordPage.getByText("Onkoloji", { exact: false }).first()).toBeVisible();
    } finally {
      await coordPage.context().close();
    }
  });
});
