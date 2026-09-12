import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import type { AuraLegalLang } from "@/lib/aura-legal/routes";
import { AuraKvkkApplicationForm } from "@/components/aura/aura-legal/AuraKvkkApplicationForm";
import { AuraLegalPage, auraLegalGenerateMetadata, type LegalSearchParams } from "@/components/aura/aura-legal/legal-page";

// /kvkk-basvuru — İlgili Kişi Başvuru Usul ve Esasları (kod Paket A, v6.268 · 2026-09-13; kaynak vault belge A07 bölüm A,
// Sürüm 1.0 NİHAİ — bölüm B iç işleyiş yayımlanmaz). Platform içi başvuru FORMU yalnız oturum açmış üyeye (hasta VE
// personel rolleri — A07 madde A.2; kimlik doğrulaması = oturum); kütük `KvkkApplication` Doctorium ile ORTAK
// (`POST /api/kvkk-basvuru` aynı işleyici). Oturum durumuna bakan server component → force-dynamic.
export const dynamic = "force-dynamic";
export const generateMetadata = auraLegalGenerateMetadata("kvkk-basvuru");

const HINT: Record<AuraLegalLang, { before: string; link: string; after: string }> = {
  tr: { before: "Platform içi başvuru formunu kullanmak için ", link: "giriş yapın", after: ". Giriş yapmadan başvuru için yukarıdaki kanalları kullanabilirsiniz." },
  en: { before: "To use the in-platform request form, ", link: "sign in", after: ". Without signing in, you can use the channels listed above." },
};

export default async function Page({ searchParams }: { searchParams: LegalSearchParams }) {
  const user = await getCurrentUser();
  return (
    <AuraLegalPage slug="kvkk-basvuru" searchParams={searchParams}>
      {(lang) =>
        user ? (
          <AuraKvkkApplicationForm lang={lang} />
        ) : (
          <section className="mt-10 border-t border-[var(--aura-hairline)] pt-8 text-sm text-[var(--aura-grey)]">
            {HINT[lang].before}
            <Link href="/giris?next=/kvkk-basvuru" className="font-medium text-[var(--aura-accent-stronger)] underline underline-offset-2">
              {HINT[lang].link}
            </Link>
            {HINT[lang].after}
          </section>
        )
      }
    </AuraLegalPage>
  );
}
