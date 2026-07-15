import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RETENTION_YEARS } from "@/lib/account-deletion";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

// /hesap — hasta hesap ayarları (v6.11). Şimdilik tek bölüm: hesap ve veri silme (KVKK m.7 / GDPR m.17).
// Yalnız HASTA: silme akışı hasta iradesine özgüdür; personel hesabının silinmesi klinik kayıt
// sahipliğini bozar (API de 403 döner — sayfa kapısı savunma-derinliği).
export const metadata = { title: "Hesabım" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  if (user.role !== "PATIENT") redirect("/");

  // Hasta dili — profil hafızasından (air_lang ile aynı sözlük); yoksa TR (kanonik).
  const u = await db.user.findUnique({ where: { id: user.id }, select: { patientLanguage: true } });
  const lang = u?.patientLanguage ?? "Türkçe";

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--c-accent)]/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent-stronger)]">
        <UserCog size={14} /> Hesabım
      </span>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--c-ink)]">Hesap ayarları</h1>

      <div className="mt-8">
        <DeleteAccountPanel lang={lang} retentionYears={RETENTION_YEARS} />
      </div>
    </div>
  );
}
