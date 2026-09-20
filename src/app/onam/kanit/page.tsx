import { getCurrentUser } from "@/lib/auth";
import { proofScopesForRole } from "@/lib/consent-proof-scopes";
import { ConsentProofClient } from "./ConsentProofClient";

export const dynamic = "force-dynamic";

// Onay Kanıtı — sunucu kabuğu (kontrol raporu H12, v6.283): kapsam sekmeleri ROLE göre kesilir (hasta personel/Doctorium
// kapsamlarını görmez); kanıtın kendisi istemcide /api/consent/proof'tan okunur (kullanıcının kendi kaydı).
export default async function ConsentProofPage() {
  const user = await getCurrentUser();
  return <ConsentProofClient scopes={proofScopesForRole(user?.role)} />;
}
