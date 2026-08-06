import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /giris/e-posta KALDIRILDI (2026-08-06, kullanıcı kararı) — kapı/form ayrımı Apple OAuth
// canlanınca (v6.83) anlamsızlaştı; e-posta formu artık /giris kapısının İÇİNDE açılıyor
// (auth-gates + GateEmailForm). Bu rota, eskiden dağıtılmış bağlantılar (doğrulama
// e-postaları, yer imleri, dış siteler) kırılmasın diye parametre koruyarak kapıya yönlendirir.
// ?verify/?oauth ile gelen ziyaretçide kapı formu OTOMATİK açılır, banner görünür.
export default async function LegacyPatientEmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") keep.set(k, v);
  }
  const q = keep.toString();
  permanentRedirect(q ? `/giris?${q}` : "/giris");
}
