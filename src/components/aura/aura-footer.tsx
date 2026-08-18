"use client";

import Link from "next/link";
import { AuraMark, AuraBraille } from "@/components/AuraLogo";
import { AuraWordText } from "@/components/aura/aura-word";
import { LangProvider, useLang, LINKS } from "@/lib/aura-landing/i18n";

// AURA alt bilgisi — vitrin + uygulama yüzeylerinin ORTAK footer'ı (kullanıcı kararı 2026-08-18).
//
// Nereden geldi: closing.tsx içinde yerel `AuraFooter` fonksiyonuydu ve yalnız AuraClosing
// üzerinden, yani 5 vitrin sayfasında (/ · /v2 · /how-it-works · /guven-ve-gizlilik ·
// /for-clinicians) çiziliyordu. Giriş yapılmış sayfalar (/vaka, /takip, /vakalarim, /paket,
// /doktor …) bunun yerine 2 satırlık SiteFooter'ı görüyordu; kullanıcı "landing footer'ı
// içerikteki sayfalarda da korunsun" dedi → bileşen dışa açıldı.
//
// ⚠️ Kapanış CTA'sı BİLİNÇLİ olarak taşınmadı: AuraClosing footer'dan önce "Ücretsiz başla →
// /giris" bandını çizer. Vitrinde doğru, uygulama içinde saçma (giriş yapmış hastaya kayıt
// çağrısı). Bu yüzden ayrım footer/CTA sınırından geçti — AuraClosing = CTA + AuraFooter.
//
// ⚠️ useLang() zorunlu: metinler vitrin sözlüğünden gelir. Uygulama ağacında LangProvider
// YOK — sarmalanmamış render REACT HATASI verir. AppAuraFooter (aşağıda) bu yüzden var;
// uygulama tarafında DAİMA onu kullan.
export function AuraFooter({ accountLinks = false }: { accountLinks?: boolean }) {
  const { t } = useLang();
  const f = t.footer;

  return (
    <footer className="border-t border-[var(--aura-hairline)] bg-[var(--aura-bg)] print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[2fr_1fr_1fr] md:px-8">
        <div>
          {/* Braille "AURA" wordmark'ın TAM ALTINDA, ortalı hizalı (marka kuralı:
              Braille daima AURA yazısının altında — [[aura-braille-under-wordmark]]). */}
          <div className="flex items-center gap-2.5">
            <AuraMark size={36} />
            <span className="inline-flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/aura-word-dark.png" alt="AURA" className="h-4 w-auto" />
              {/* height=12 → 56px: AuraBraille min-genişlik eşiği (56px). Daha küçüğü
                  eşiğin altına düşer ve Braille hiç çizilmez → küçültme. */}
              <AuraBraille height={12} className="mt-1.5 text-[var(--aura-micro)]" />
            </span>
          </div>
          {/* Metin içi AURA = wordmark görseli (kullanıcı kuralı 2026-08-17). */}
          <p className="mt-4 max-w-[38ch] text-sm leading-relaxed text-[var(--aura-grey)]">
            <AuraWordText text={t.chapters[0].body} />
          </p>
        </div>
        <div>
          <p className="aura-display text-sm font-bold">{f.platform}</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--aura-grey)]">
            <li>
              <FooterLink href={LINKS.platformLogin} label={f.patientLogin} />
            </li>
            <li>
              <FooterLink href={LINKS.platformSignup} label={f.patientSignup} />
            </li>
            <li>
              {/* Kurumsal giris artik vitrinin kendi rol-secicili sayfasindan */}
              <Link
                href="/kurumsal-giris"
                className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
              >
                {f.corporateLogin}
              </Link>
            </li>
            <li>
              <FooterLink href={LINKS.doctorSignup} label={f.doctorSignup} />
            </li>
            {/* Tıp öğrencisi linki KALDIRILDI (kullanıcı kararı 2026-08-17): öğrenci
                kapısı artık Doctorium landing'inde yaşıyor (/doctorium → /ogrenci);
                vitrin footer'ında ikinci kopyaya gerek yok. f.students sözlükte
                duruyor (başka yüzeyler + yapı imzası). */}
            {/* Hesap şeffaflık bağlantıları — YALNIZ uygulama içinde (accountLinks).
                Neden: bu iki sayfaya tüm sitedeki TEK giriş noktası eski SiteFooter'dı
                (Header'da, hesap menüsünde yok — 2026-08-18 ölçümü). Footer değişirken
                sessizce erişilemez hâle gelmeleri KVKK şeffaflığında geri adım olurdu.
                Vitrinde gösterilmez: giriş yapmamış ziyaretçi için ikisi de anlamsız. */}
            {accountLinks && (
              <>
                <li>
                  <Link
                    href="/onam/kanit"
                    className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
                  >
                    Onay Kanıtım
                  </Link>
                </li>
                <li>
                  <Link
                    href="/erisim-kaydi"
                    className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
                  >
                    Erişim Kaydım
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
        <div>
          <p className="aura-display text-sm font-bold">{f.explore}</p>
          {/* Capalar kok-goreli: footer /how-it-works sayfasinda da render edilir. */}
          <ul className="mt-3 space-y-2 text-sm text-[var(--aura-grey)]">
            <li>
              <FooterLink href="/#ch-consult" label={f.telehealth} />
            </li>
            <li>
              <FooterLink href="/#ch-tourism" label={f.tourism} />
            </li>
            <li>
              <FooterLink href="/#doctors" label={f.doctors} />
            </li>
            <li>
              <Link
                href="/how-it-works"
                className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
              >
                {t.nav.how}
              </Link>
            </li>
            <li>
              <Link
                href="/guven-ve-gizlilik"
                className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
              >
                {f.trust}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--aura-hairline)]">
        <p className="aura-mono mx-auto max-w-6xl px-5 py-5 text-[11px] text-[var(--aura-micro)] md:px-8">
          <AuraWordText text={f.legal} />
        </p>
      </div>
    </footer>
  );
}

// Uygulama yüzeyi sarmalayıcısı: kendi LangProvider'ını kurar (vitrin kabuğu dışında context
// yok) ve hesap şeffaflık bağlantılarını açar. SiteFooter bunu render eder.
//
// initialLang="tr" ZORUNLU — prop'suz LangProvider EN başlar ve yalnız air_lang varsa düzelir;
// ilk denemede /kayit/hasta footer'ı "Patient login / Explore / Trust & Privacy" çıktı
// (2026-08-18 tarayıcı ölçümü). Uygulama yüzeyinin KAYNAK dili Türkçe (lib/i18n.ts: "Türkçe
// hedefte kimlik döner"), dolayısıyla footer'ın da TR olması doğru varsayılan.
// ⚠️ Bu, footer'ı vitrinin dil seçicisinden koparır: hasta vitrinde EN seçse de uygulama
// footer'ı TR kalır. Footer'ı uygulamanın çeviri hattına (getTranslations) bağlamak ayrı bir
// iş — vitrin sözlüğü (COPY) ile uygulama çeviri hattı farklı sistemler.
export function AppAuraFooter() {
  return (
    <LangProvider initialLang="tr">
      <AuraFooter accountLinks />
    </LangProvider>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="transition-colors duration-200 hover:text-[var(--aura-accent)]">
      {label}
    </a>
  );
}
