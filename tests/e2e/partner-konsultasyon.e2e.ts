import { test, expect } from "@playwright/test";
import { loginAs, contextAs, expectNotVisible } from "./helpers";

// AKIŞ 3 — Partner konsültasyon talebi → DE-ID (anonimleştirme) → doktor havuzu (isim SIZMAZ).
//
// ASIL AMAÇ = GÜVENLİK: partnerin klinik özete gömdüğü hasta ADI / satır-içi tanımlayıcılar,
// doktorun konsültasyon havuzunda (gelen kutusu) GÖRÜNMEMELİ.
//
// Kaynak eşlemesi (selektörler kaynaktan alındı, TAHMİN yok):
//  - Partner talep formu:  src/app/partner/talep/PartnerRequestForm.tsx (+ page.tsx UI metinleri)
//  - Partner paneli:       src/app/partner/page.tsx (gönderim sonrası /partner'a döner)
//  - Doktor havuzu:        src/app/doktor/konsultasyon/page.tsx
//  - De-id davranışı:      src/lib/deidentify.ts (scrubText) + src/lib/consultation-requests.ts
//  - Demo hesap seed:      scripts/seed-partner.ts (partner) + prisma/seed.ts (doktor)
//
// ── KRİTİK SEED/DAVRANIŞ GERÇEKLERİ (testin neden böyle kurulduğu) ──
//  1) Partner (partner@air.test) = Dr. Sarah Klein · branch="Kardiyoloji" · language=null→"İngilizce".
//     → PartnerRequestForm ARAYÜZÜ İNGİLİZCEYE çevrilir (getTranslations). Bu yüzden form
//     selektörleri Türkçe etikete GÜVENMEZ; textarea/select/number gibi YAPISAL seçiciler kullanılır.
//  2) Form default'u branchLimited = !!defaultBranch. Sarah'nın branch'i dolu olduğundan talep
//     VARSAYILAN olarak "Kardiyoloji" ile sınırlı açılır. Demo doktor (doktor@air.test) =
//     Mehmet Yıldız · branch="Onkoloji". Branş sınırı AÇIK kalırsa Onkoloji doktoru talebi GÖREMEZ.
//     → Bu testte branş sınırı checkbox'ı KALDIRILIR ki talep GENEL HAVUZA (branch=null) düşsün ve
//       her branştan doktor (Onkoloji dahil) görebilsin. [LIVE-ITERATE: checkbox durumu aşağıda]
//  3) Doktor havuzu (page.tsx) doctor.consultOptIn=false ise /doktor'a REDIRECT eder. Seed'de
//     consultOptIn DEFAULT=false. → Test, doktor bağlamında havuzu görebilmek için önce
//     consultOptIn'i AÇAR (doktor profili). [LIVE-ITERATE: profil toggle etiketi/kaydı]
//
// ── DE-ID KAPSAMI (deidentify.ts scrubText) ──
//  Yapısal tanımlayıcılar GARANTİLİ maskelenir: e-posta → "[e-posta]", TC (11 hane) → "[kimlik no]",
//  telefon, tarih. ANCAK createRequestFromInput, scrubText'i names=[] (BOŞ) ile çağırır → serbest
//  metindeki düz bir HASTA ADI (yapısal desene uymayan) maskelenMEYEBİLİR. Bu yüzden güvenlik iki
//  katmanda doğrulanır: (A) e-posta = SAĞLAM kanıt (kesin maskelenir); (B) düz ad = görev katmanı
//  (LIVE-ITERATE — mevcut scrubText(...,[]) ile SIZABİLİR; canlıda doğrula/karar ver).
//
// Kırılgan/dış bağımlılıklar (DENENMEZ):
//  • processRequestAi (özet TR çeviri + belge AI): anahtar yoksa best-effort; içerik assert EDİLMEZ.
//  • Belge yükleme opsiyonel — bu akışta yalnız metin gönderilir (de-id sızıntı odaklı).

// Ayırt edici işaretçiler → havuzda tek/kesin eşleşme + de-id sızıntı kontrolü.
const stamp = Date.now();
const secretName = `Zeynep Kaya Test ${stamp}`; // hasta adı — SIZMAMALI (görev katmanı)
const secretEmail = `hasta.${stamp}@ornek-sizinti.test`; // e-posta — de-id GARANTİLİ maskeler
const clinicalMarker = `E2E-KONSULT-${stamp}`; // klinik metin işaretçisi — havuzda GÖRÜNMELİ
// Özet, klinik içerik + KASITLI sızıntı denemesi (ad + e-posta) içerir (min 10 karakter şartını aşar).
const clinicalSummary =
  `${clinicalMarker} Hastada 3 gündür süren göğüs ağrısı ve nefes darlığı var, EKG çekildi. ` +
  `Hasta adı ${secretName}, iletişim ${secretEmail}. Kardiyoloji ikinci görüşü istiyoruz.`;

test("partner talep → de-id → doktor havuzu: klinik özet görünür, hasta kimliği sızmaz", async ({
  page,
  browser,
}) => {
  // İki rol context'i + AI işleme (processRequestAi, maxDuration=60) + havuz opt-in adımı → global
  // 60s timeout dar kalabilir. Bu senaryoyu genişlet (config default'unu bu test için ez).
  test.setTimeout(150_000);

  await test.step("Partner giriş + konsültasyon talep formunu doldur (ad + e-posta KASITLI gömülü)", async () => {
    // page → Partner Doktor bağlamı (ilk rol). loginAs quick-login + onam kapısını geçer.
    await loginAs(page, "Partner Doktor");
    await page.goto("/partner/talep");

    // Form kartı render oldu mu — arayüz partner dilinde (İngilizce) olabileceğinden metne değil,
    // formun yapısal iskeletine (textarea = tek serbest-metin alanı) bakılır.
    const summary = page.locator("textarea");
    await expect(summary).toBeVisible({ timeout: 15_000 });

    // Submit butonunu FORM KARTINA scope'la — sayfa layout'unda Header (bildirim zili + Çıkış) da
    // <button> içerir; kaba .last() header'ın portal/dropdown butonunu seçebilir. Form kartı = textarea'yı
    // içeren rounded-3xl kap; içinde TEK button (submit) var (geri "Panel" butonu kart DIŞINDA).
    const formCard = page.locator("div.rounded-3xl").filter({ has: summary });
    const submitBtn = formCard.getByRole("button");

    // Branş sınırı checkbox'ını KALDIR → talep genel havuza düşsün (Onkoloji doktoru da görsün).
    // Form default'u branchLimited=true (Sarah'nın branch'i dolu). Kart içindeki tek checkbox = branş sınırı.
    // LIVE-ITERATE: checkbox işaretli-değilse (branchLimited zaten false) uncheck no-op olur; sorun değil.
    const branchLimitCheckbox = formCard.locator('input[type="checkbox"]').first();
    if (await branchLimitCheckbox.isChecked()) {
      await branchLimitCheckbox.uncheck();
    }

    // Klinik özet (min 10 karakter). textarea tek olduğu için doğrudan doldurulur.
    await summary.fill(clinicalSummary);

    // Gönder — buton metni partner dilinde çevrili ("Talebi gönder" TR kanonik) olduğundan metne değil
    // form-kartı-içi tek eylem butonuna bağlanılır.
    await submitBtn.click();

    // Gönderim başarılıysa /partner paneline döner (router.push("/partner")). AI işleme (maxDuration=60)
    // nedeniyle cömert timeout; panele dönüş = talebin OLUŞTUĞUNUN kanıtı.
    await page.waitForURL((url) => url.pathname === "/partner", { timeout: 60_000 });

    // Panelde talebin gönderilen anonim özeti görünür (klinik işaretçi). Partner KENDİ panelinde
    // özeti scrub SONRASI haliyle görür; klinik marker burada da olmalı.
    await expect(page.getByText(clinicalMarker, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  });

  // ── İKİNCİ ROL: Doktor (yeni izole context → çerez karışmaz) ──
  const doctorPage = await contextAs(browser, "Doktor");

  await test.step("Doktor consultOptIn'i açar (havuz görünürlüğü için) — best-effort", async () => {
    // Havuz sayfası consultOptIn=false ise /doktor'a redirect eder (page.tsx). Demo doktorun default'u
    // false → önce profil tercihinden Konsültasyon opt-in açılır (DoctorPreferences → /api/doctor/preferences).
    // Toggle = <button aria-pressed> · adı kaynakta TR sabit "Konsültasyon Talepleri — Partner doktorlar"
    // (title buton adına yansır). Kaydet butonu = "Tercihleri kaydet".
    // LIVE-ITERATE: doktor profili rotası /doktor/profil varsayıldı; DoctorPreferences başka sayfadaysa güncelle.
    await doctorPage.goto("/doktor/profil");
    const consultToggle = doctorPage.getByRole("button", { name: /Konsültasyon Talepleri/ });
    if (await consultToggle.count()) {
      // DİKKAT: toggle'dır → zaten açıksa (aria-pressed=true) tekrar tıklamak KAPATIR. Yalnız kapalıysa aç.
      const pressed = await consultToggle.first().getAttribute("aria-pressed");
      if (pressed !== "true") {
        await consultToggle.first().click();
        await doctorPage.getByRole("button", { name: /Tercihleri kaydet/i }).click();
        // Kayıt tamamlandı göstergesi: buton "Kaydedildi"ye döner (Check ikonu). Ona bağlan.
        await expect(
          doctorPage.getByRole("button", { name: /Kaydedildi/i }),
        ).toBeVisible({ timeout: 15_000 });
      }
    }
    // LIVE-ITERATE: consultOptIn açılamadıysa (rota/etiket sürüklendi) aşağıdaki havuz adımı /doktor'a
    // düşer → talep görünmez. Alternatif: seed'de doktor consultOptIn=true veya API'yi doğrudan çağır.
  });

  await test.step("Doktor havuzunda talep GÖRÜNÜR ama hasta kimliği SIZMAZ", async () => {
    await doctorPage.goto("/doktor/konsultasyon");

    // Havuz sayfası açıldı mı (redirect olmadıysa) — sabit TR başlık "Konsültasyon Talepleri".
    // LIVE-ITERATE: consultOptIn kapalıysa buraya gelmeden /doktor'a redirect olur → heading bulunamaz.
    await expect(
      doctorPage.getByRole("heading", { name: "Konsültasyon Talepleri" }),
    ).toBeVisible({ timeout: 15_000 });

    // (1) Talep havuzda GÖRÜNÜR: klinik işaretçi (marker) açık talepler bölümünde okunur.
    // Not: summaryTr varsa TR öncelikli gösterilir; marker her iki dilde de değişmez (kod-benzeri token).
    await expect(
      doctorPage.getByText(clinicalMarker, { exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // (2A) SAĞLAM güvenlik kanıtı — e-posta de-id ile GARANTİLİ maskelenir (scrubText EMAIL_RE →
    //      "[e-posta]"). Bu, anonimleştirme katmanının GERÇEKTEN çalıştığını kesin doğrular.
    await expectNotVisible(doctorPage, secretEmail);

    // (2B) GÖREV katmanı — düz hasta ADI havuzda görünmemeli (de-identification amacı).
    //      LIVE-ITERATE: createRequestFromInput → scrubText(summary, []) (isim listesi BOŞ) olduğundan
    //      düz ad şu an MASKELENMEYEBİLİR → bu assertion canlıda BAŞARISIZ olabilir. Başarısızsa bu,
    //      kaynak davranışının (partner serbest-metin adı scrub edilmiyor) bir bulgusudur; test değil
    //      ÜRÜN düzeltilmelidir (scrub'a hasta-adı listesi verilmesi ya da forma ad-yasak doğrulaması).
    await expectNotVisible(doctorPage, secretName);
  });
});
