import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /kurumsal-giris/e-posta KALDIRILDI (2026-08-06) — /giris/e-posta ile aynı karar: e-posta
// formu (demo hızlı-giriş dahil) artık /kurumsal-giris kapısının İÇİNDE açılıyor. Eski
// bağlantılar parametre koruyarak kapıya yönlendirilir; ?verify/?oauth formu otomatik açar.
export default async function LegacyCorporateEmailLoginPage({
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
  permanentRedirect(q ? `/kurumsal-giris?${q}` : "/kurumsal-giris");
}
