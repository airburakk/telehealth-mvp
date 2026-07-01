import { test, expect } from "@playwright/test";
import { loginAs, contextAs, expectNotVisible } from "./helpers";

// AKIŞ 3 — Partner konsültasyon talebi → DE-ID (anonimleştirme) → doktor havuzu (isim SIZMAZ).
//
// ASIL AMAÇ = GÜVENLİK: partnerin klinik özete gömdüğü hasta ADI / satır-içi tanımlayıcılar,
// doktorun konsültasyon havuzunda (gelen kutusu) GÖRÜNMEMELİ.
//
// Kaynak eşlemesi (selektörler kaynaktan alındı, TAHMİN yok):
//  - Partner talep formu:  src/app/partner/talep/PartnerRequestForm.tsx (textarea + rounded-3xl kart)
//  - Partner paneli:       src/app/partner/page.tsx (gönderim sonrası /partner'a döner)
//  - Doktor havuzu:        src/app/doktor/konsultasyon/page.tsx (h1 "Konsültasyon Talepleri")
//  - Doktor profili:       src/app/doktor/profil/page.tsx + src/components/DoctorPreferences.tsx
//  - De-id davranışı:      src/lib/deidentify.ts (scrubText) + src/lib/consultation-requests.ts
//  - Demo hesap seed:      scripts/seed-partner.ts (partner) + prisma/seed.ts (doktor)
//
// ── KRİTİK SEED/DAVRANIŞ GERÇEKLERİ (testin neden böyle kurulduğu) ──
//  1) Partner (partner@air.test) = Dr. Sarah Klein · branch="Kardiyoloji" · dili ALMANCA.
//     → PartnerRequestForm ARAYÜZÜ çevrilir. Bu yüzden form selektörleri çevrilebilir etikete
//     GÜVENMEZ; textarea/checkbox/button gibi YAPISAL seçiciler kullanılır. (Canlıda panel de
//     Almanca render oldu: "Meine ausstehenden Anfragen" — bu yüzden assertion'lar locale-bağımsız.)
//  2) Form default'u branchLimited = !!defaultBranch. Sarah'nın branch'i dolu olduğundan talep
//     VARSAYILAN olarak "Kardiyoloji" ile sınırlı açılır. Demo doktor (doktor@air.test) =
//     Mehmet Yıldız · branch="Onkoloji". Branş sınırı AÇIK kalırsa Onkoloji doktoru talebi GÖREMEZ.
//     → Bu testte branş sınırı checkbox'ı KALDIRILIR ki talep GENEL HAVUZA (branch=null) düşsün ve
//       her branştan doktor (Onkoloji dahil) görebilsin.
//  3) Doktor havuzu (page.tsx) doctor.consultOptIn=false ise /doktor'a REDIRECT eder. Seed'de
//     consultOptIn DEFAULT=false. → Test, doktor bağlamında havuzu görebilmek için önce
//     consultOptIn'i AÇAR (doktor profili · DoctorPreferences). Doktor (Mehmet Yıldız) dili Türkçe
//     olduğundan profil arayüzü TR sabit kalır → toggle/kaydet etiketleri TR ile güvenli eşleşir.
//
// ── DE-ID KAPSAMI (deidentify.ts scrubText) — TESTİN İŞARETÇİ TASARIMI ──
//  Yapısal tanımlayıcılar GARANTİLİ maskelenir: e-posta → "[e-posta]", TC (11 hane) → "[kimlik no]",
//  11+ haneli RAKAM dizisi → "[telefon]", tam tarih → "[tarih]".
//  ⚠️ Bu yüzden İŞARETÇİLER (havuzda GÖRÜNMESİ gereken marker + hasta adı) RAKAM İÇEREMEZ — aksi
//  halde scrubText marker'ı "[telefon]" ile bozar (önceki başarısızlığın kök nedeni: Date.now()
//  13 haneli → PHONE_RE marker'ın son bloğunu maskeledi → getByText(marker) bulunamadı).
//  → Benzersizlik için Date.now() base36'ya çevrilip RAKAMLARDAN ARINDIRILIR (harf-only alfa son ek).
//
// Kırılgan/dış bağımlılıklar (DENENMEZ):
//  • processRequestAi (özet TR çeviri + belge AI): anahtar yoksa best-effort; içerik assert EDİLMEZ.
//  • Belge yükleme opsiyonel — bu akışta yalnız metin gönderilir (de-id sızıntı odaklı).

// Date.now()'ı base36'ya çevir, sonra rakamları harflere eşle → tamamen RAKAMSIZ benzersiz alfa son ek.
// (0→g,1→h,…,9→p; harfler zaten a-z aralığında kalır.) scrubText hiçbir kuralına takılmaz.
function alphaSuffix(): string {
  const base36 = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return base36.replace(/[0-9]/g, (d) => String.fromCharCode(97 + 6 + Number(d))); // '0'→'g' … '9'→'p'
}

// Ayırt edici işaretçiler → havuzda tek/kesin eşleşme + de-id sızıntı kontrolü.
// HEPSİ RAKAMSIZ (scrubText'in TC/telefon/tarih/pasaport kurallarının HİÇBİRİNE takılmaz).
const uniq = alphaSuffix();
// Hasta adı — KOŞUYA ÖZEL benzersiz + isim-benzeri (ör. "Zeynep Mricoc"). Benzersizlik ŞART: dev branch'te
// önceki koşuların talepleri partner panelinde/havuzda BİRİKİR; sabit ad eski (redaksiyon-öncesi) kayıtlarla
// yanlış-pozitif verirdi. Benzersiz ad → assertion yalnız BU koşunun talebini denetler.
// createRequestFromInput'ta AI isim redaksiyonu (redactPersonNames) bunu [ad] yapar → SIZMAMALI.
const secretName = `Zeynep ${uniq.charAt(0).toUpperCase()}${uniq.slice(1, 6)}`;
const secretEmail = `hasta.${uniq}@ornek-sizinti.test`; // e-posta — de-id GARANTİLİ maskeler ([e-posta])
const clinicalMarker = `E2EKONSULTMARKER${uniq}`; // klinik metin işaretçisi (kod-token, RAKAMSIZ) — havuzda GÖRÜNMELİ
// Özet: klinik içerik + KASITLI sızıntı denemesi (ad + e-posta). min 10 karakter şartını rahat aşar.
const clinicalSummary =
  `${clinicalMarker} Hastada birkaç gündür süren göğüs ağrısı ve nefes darlığı var, EKG çekildi. ` +
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

    // Form kartı render oldu mu — arayüz partner dilinde (Almanca) olabileceğinden metne değil,
    // formun yapısal iskeletine (textarea = tek serbest-metin alanı) bakılır.
    const summary = page.locator("textarea");
    await expect(summary).toBeVisible({ timeout: 15_000 });

    // Submit butonunu FORM KARTINA scope'la — sayfa layout'unda Header (bildirim zili + Çıkış) da
    // <button> içerir; kaba .last() header'ın portal/dropdown butonunu seçebilir. Form kartı = textarea'yı
    // içeren rounded-3xl kap; içinde TEK <button> var (submit — kaynakta form-kartı içindeki tek buton;
    // geri/"Panel" butonu kartın DIŞINDA). Belge yükleme <input type=file> (button değil).
    const formCard = page.locator("div.rounded-3xl").filter({ has: summary });
    const submitBtn = formCard.getByRole("button");

    // Branş sınırı checkbox'ını KALDIR → talep genel havuza düşsün (Onkoloji doktoru da görsün).
    // Form default'u branchLimited=true (Sarah'nın branch'i dolu). Kart içindeki tek checkbox = branş sınırı.
    // Checkbox işaretli-değilse (branchLimited zaten false) uncheck no-op olur; sorun değil.
    const branchLimitCheckbox = formCard.locator('input[type="checkbox"]').first();
    if (await branchLimitCheckbox.isChecked()) {
      await branchLimitCheckbox.uncheck();
    }

    // Klinik özet (min 10 karakter). textarea tek olduğu için doğrudan doldurulur.
    await summary.fill(clinicalSummary);

    // Gönder — buton metni partner dilinde çevrili olduğundan metne değil, form-kartı-içi tek eylem butonuna bağlanılır.
    await submitBtn.click();

    // Gönderim başarılıysa /partner paneline döner (router.push("/partner")). AI işleme (maxDuration=60)
    // nedeniyle cömert timeout; panele dönüş = talebin OLUŞTUĞUNUN kanıtı.
    await page.waitForURL((url) => url.pathname === "/partner", { timeout: 60_000 });

    // Panelde talebin gönderilen anonim özeti görünür (klinik işaretçi). Partner KENDİ panelinde
    // özeti scrub + AI isim redaksiyonu SONRASI haliyle görür; RAKAMSIZ marker (anlamsız kod-token)
    // hem scrubText'ten hem isim-redaksiyonundan DEĞİŞMEDEN geçer → görünmeli (locale-bağımsız).
    await expect(page.getByText(clinicalMarker, { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    // DE-ID (partner tarafı): düz hasta adı KAYDEDİLMEDEN redakte edildiği için partnerin KENDİ panelinde
    // bile görünmemeli (isim DB'ye [ad] olarak yazıldı → summaryTr çevirisi de temiz).
    await expectNotVisible(page, secretName);
  });

  // ── İKİNCİ ROL: Doktor (yeni izole context → çerez karışmaz) ──
  const doctorPage = await contextAs(browser, "Doktor");

  await test.step("Doktor consultOptIn'i açar (havuz görünürlüğü için) — best-effort", async () => {
    // Havuz sayfası consultOptIn=false ise /doktor'a redirect eder (page.tsx). Demo doktorun default'u
    // false → önce profil tercihinden Konsültasyon opt-in açılır (DoctorPreferences → /api/doctor/preferences).
    // Toggle = OptToggle <button aria-pressed> · accessible name = title+desc → "Konsültasyon Talepleri …" içerir.
    // Kaydet butonu metni: açık iken "Tercihleri kaydet", kayıt sonrası "Kaydedildi" (DoctorPreferences).
    // Doktor (Mehmet Yıldız) dili Türkçe → profil arayüzü TR sabit; bu etiketler güvenli.
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
    // consultOptIn açılamadıysa (rota/etiket sürüklendi) aşağıdaki havuz adımı /doktor'a düşer →
    // heading bulunamaz → test net şekilde başarısız olur (sessiz geçmez).
  });

  await test.step("Doktor havuzu talepleri render eder ama hasta KİMLİĞİ (ad + e-posta) SIZMAZ", async () => {
    await doctorPage.goto("/doktor/konsultasyon");

    // Havuz sayfası açıldı mı (redirect olmadıysa) — sabit TR başlık "Konsültasyon Talepleri" (h1).
    // consultOptIn kapalıysa buraya gelmeden /doktor'a redirect olur → heading bulunamaz.
    await expect(
      doctorPage.getByRole("heading", { name: "Konsültasyon Talepleri" }),
    ).toBeVisible({ timeout: 15_000 });

    // (1) Havuz açık talepleri render eder ("Açık talepler (N)", N≥1). Talebin OLUŞTUĞU zaten partner
    //     panelinde doğrulandı (yukarıda marker görüldü). Doktor tarafında marker'a ÇIPALAMIYORUZ çünkü
    //     havuz yabancı-dil talepleri summaryTr (Claude çevirisi) ile gösterir ve çeviri ANLAMSIZ opak
    //     token'ı (marker) DÜŞÜRÜR (canlıda doğrulandı: çevrili özette klinik metin var, marker yok).
    //     Bu yüzden doktor tarafında güvenilir + anlamlı olan: havuzun render'ı + e-posta maskesi.
    await expect(
      doctorPage.getByRole("heading", { name: /Açık talepler \(\d+\)/ }),
    ).toBeVisible({ timeout: 15_000 });

    // (2A) E-POSTA — de-id ile GARANTİLİ maskelenir (scrubText EMAIL_RE → "[e-posta]"). Sayfa-geneli
    //      kontrol: sızıntı e-postası havuzda HİÇBİR YERDE görünmemeli.
    await expectNotVisible(doctorPage, secretEmail);

    // (2B) DÜZ HASTA ADI — AI isim redaksiyonu (createRequestFromInput → redactPersonNames) ile [ad]
    //      yapıldığından havuzda (çevrili summaryTr dahil) GÖRÜNMEMELİ. Bu, yapısal scrub'ın yakalayamadığı
    //      serbest-metin adı de-id boşluğunun KAPANDIĞINI doğrular (KVKK/GDPR minimizasyon).
    await expectNotVisible(doctorPage, secretName);
  });
});
