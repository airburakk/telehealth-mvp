import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGES, COUNTRIES } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";
import { PartnerRequestForm } from "./PartnerRequestForm";

export const dynamic = "force-dynamic";

// M5 Faz 3 — Partner doktorun anonim konsültasyon talebi oluşturma formu.
export default async function PartnerRequestPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/giris?next=/partner/talep");
  const u = await db.user.findUnique({ where: { id: session.id }, select: { partnerId: true } });
  const partner = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId }, select: { country: true, branch: true } }) : null;
  if (!partner) redirect("/");

  return (
    <PartnerRequestForm
      branches={BRANCHES.map((b) => b.label)}
      countries={COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: c.flag }))}
      languages={LANGUAGES}
      defaultCountry={partner.country}
      defaultBranch={partner.branch}
    />
  );
}
