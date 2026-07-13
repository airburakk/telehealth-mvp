# QA Raporu — v5.8 Hasta Akış Turu (kullanıcı gözüyle)

- **Tarih:** 2026-07-12
- **Hedef:** http://localhost:3000 (dev, main @ 3f8b3e4)
- **Kapsam:** v5.8 basitleştirme yüzeyi — 3-adımlı triyaj, prefill kimlik şeridi, /vaka hub'ı, kulvara-göre sahne rayı, karma-kulvar yönlendirme düzeltmesi
- **Tier:** Standard · **Mod:** kapsam-odaklı akış turu (kapanış notu havuzu #1)
- **Araç:** Gömülü Browser pane (gstack browse binary'si bu Windows kurulumunda build edilmemiş — bilinen durum; DOM + konsol + davranış kanıtı aynı disiplinle toplandı, ekran görüntüsü yerine DOM durum dökümleri kullanıldı)
- **Not:** Çalışma ağacında paralel oturuma ait commit'lenmemiş AURA landing dosyaları vardı (src/components/aura, src/lib/aura-landing, public/assets, package.json'da gsap/lenis) — kullanıcı onayıyla dokunulmadan ilerlendi.

## Sonuç: 7/7 test PASS — düzeltme gerektiren bug bulunamadı

**Sağlık skoru: 99/100** (tek kesinti: düşük-önem UX gözlemi, aşağıda)

| # | Test | Sonuç | Kanıt |
|---|------|-------|-------|
| T1 | Dönen hasta inişi + nav (karma-kulvar fix'i) | ✅ PASS | Demo giriş → `/vakalarim`; nav `/vakalarim` + `/takip` + `/paylasimlarim`; 3 kulvar kartı listede |
| T2 | K1 hunisi uçtan uca | ✅ PASS | Kapı: rail "▶Onay & Ödeme"; kart simülasyonu geçti (Ref SIM-LKMFB3); 3 adım (Şikayet → Branş Soruları → Belgeler & Gönder); prefill şeridi tam (Demo Hasta · 🇩🇿 Cezayir · +90 555… · iletişim tercihi · Değiştir); AI boğaz şikayetini KBB'ye yönlendirdi, dinamik KBB soruları geldi; submit → `/vaka/cmrhvnd3l…` hub (tracker + vaka kartı + AI triyaj gerekçesi + 3-seçenek kapısı). Konsol: 0 hata |
| T3 | Zengin vaka hub'ı + eski rota | ✅ PASS | Rezervasyonlu vakada hub tam render: ilerlemiş tracker, aktif görüşme CTA, post-op bandı, gömülü paket (Ekonomik $5,242) + escrow kırılımı + sigorta teminatı + hasta yolculuğu (0/5). `/triyaj/[id]` → `/vaka/[id]` kalıcı redirect doğrulandı |
| T4 | SO tek-oturum başvuru | ✅ PASS | Rail 4 sahne "▶Başvuru & Ödeme → Eşleşme → Görüşme → Sonuç & Takip"; prefill şeridi tam; "Öde ve gönder (600 USD)" + "Belgeleri sonra tamamla" tek oturumda |
| T5 | Sağlık Turizmi planlayıcı | ✅ PASS | Rail: "▶Ön Bilgi, ~~Onay & Ödeme~~ (N/A üstü çizili)"; prefill şeridi (telefon + iletişim tercihi — ad/ülke formun kendi alanları, tutarlı) |
| T6 | Ücretsiz Sağlık (K4 kilidi) | ✅ PASS | "Başvur ve eşleş" aktif (kilit yok — F4); "çevrimiçi · 1 gönüllü doktor şu an müsait" rozeti; rail + prefill doğru |
| T7 | Sonlandır-ve-sil akışı | ✅ PASS | Hub kapısı 3. seçenek: onay sonrası "Süreciniz sonlandırıldı — Tüm verileriniz silindi ve ödemeniz iade edildi"; vaka listeden düştü (57 link, test vakası yok) — test verisi de böylece temizlendi |
| + | Mobil (375px) | ✅ PASS | Gövdede yatay taşma yok; sahne rayı kendi `overflow-x:auto` alanında kayıyor |
| + | Konsol süpürmesi | ✅ 0 hata | Ziyaret edilen tüm sayfalarda (vakalarim, triyaj kapı+sihirbaz, vaka hub ×2, SO başvuru, turizm, ücretsiz) hata yok |

## Gözlemler (düzeltme yapılmadı)

- **[DÜŞÜK/UX] Native `confirm()` — "Sonlandır ve sil":** Vaka sonlandırma onayı tarayıcının yerel confirm diyaloğuyla alınıyor. Uygulamanın geri kalanı özel gece-temalı modallar kullanırken bu adım sistem diyaloğuna düşüyor; gömülü tarayıcılarda/webview'larda da sorun çıkarabiliyor (bu turda diyalog otomasyonu blokladı). Öneri: mevcut modal desenine geçir. Tier=Standard olduğundan düşük-önem düzeltmesi ertelendi.
- **Sekme başlığı** tüm sayfalarda "AURA — Sağlık Turizmi & Teletıp" — kapanış notuna göre bilinçli; istenirse ayrı sadeleştirme işi.
- **K4 "0 doktor" dalı** canlıda test edilemedi (1 gönüllü çevrimiçiydi); buton-her-zaman-aktif davranışı kod kararı gereği (F4) ve buton aktifti.

## Yapılan düzeltme / commit

Yok — bug bulunamadı, fix döngüsü çalışmadı. (Bugün daha önce aynı yüzeyde iki fix zaten inmişti: `3294e93` sahne rayı, `3f8b3e4` karma-kulvar.)

## PR özeti

> QA (v5.8 akış turu): 7/7 senaryo geçti, 0 bug, konsol temiz, sağlık skoru 99/100. Tek düşük-önem UX notu: sonlandırma onayı native confirm.
