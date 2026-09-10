import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LegalPage, legalMetadata } from "@/components/aura/doctorium-legal/legal-page";
import { KvkkApplicationForm } from "@/components/aura/doctorium-legal/KvkkApplicationForm";

// /doctorium/kvkk-basvuru — İlgili Kişi Başvuru Usul ve Esasları (v6.210; kaynak vault belge 06 §A,
// 👤 nihai). Platform içi başvuru FORMU (Paket 2, 2026-09-09) artık CANLI — yalnız oturum açmış
// üyeye açık (kimlik doğrulaması = oturum, 06 madde A.2). Oturum durumuna bakan server component
// olduğu için force-dynamic (statik prerender'da cookie okunamaz).
export const dynamic = "force-dynamic";
export const metadata = legalMetadata("kvkk-basvuru");

export default async function Page() {
  const user = await getCurrentUser();
  return (
    <LegalPage slug="kvkk-basvuru">
      {user ? (
        <KvkkApplicationForm />
      ) : (
        <section className="mt-10 border-t border-[var(--c-hairline)] pt-8 text-sm text-[var(--c-ink-2)]">
          Platform içi başvuru formunu kullanmak için{" "}
          <Link href="/giris?next=/doctorium/kvkk-basvuru" className="text-[var(--c-accent)] underline underline-offset-2">
            giriş yapın
          </Link>
          . Giriş yapmadan da <strong>bilgi@doctorium.tr</strong> adresine başvurabilirsiniz.
        </section>
      )}
    </LegalPage>
  );
}
