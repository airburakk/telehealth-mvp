import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RETENTION_YEARS } from "@/lib/account-deletion";
import { consentStatus, HEALTH_DECLARATION_VERSION, REVOCABLE_SCOPES } from "@/lib/aura-consent";
import { AI_CONSENT_VERSION, AI_INTERPRET_VERSION } from "@/lib/ai-consent";
import { consentLangFor } from "@/lib/consent-lang";
import { DeleteAccountPanel } from "./DeleteAccountPanel";
import { ConsentWithdrawPanel, type ConsentItem } from "./ConsentWithdrawPanel";

// /hesap — hasta hesap ayarları (v6.11). v6.269 (kod Paket B): "Rızalarım" paneli — geri alınabilir açık rızaların
// (AI ön değerlendirme · AI tercüme · sigorta beyanı) durumu ve geri alma (A01 madde 12 / A04); altta hesap ve veri silme
// (KVKK m.7 / GDPR m.17). Yalnız HASTA: silme akışı hasta iradesine özgüdür; personel hesabının silinmesi klinik kayıt
// sahipliğini bozar (API de 403 döner — sayfa kapısı savunma-derinliği).
export const metadata = { title: "Hesabım" };
export const dynamic = "force-dynamic";

const SCOPE_VERSION: Record<(typeof REVOCABLE_SCOPES)[number], number> = {
  AI_TRIAGE: AI_CONSENT_VERSION,
  AI_INTERPRET: AI_INTERPRET_VERSION,
  HEALTH_DECLARATION: HEALTH_DECLARATION_VERSION,
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  if (user.role !== "PATIENT") redirect("/");

  // Hasta dili — profil hafızasından (air_lang ile aynı sözlük); yoksa TR (kanonik).
  const u = await db.user.findUnique({ where: { id: user.id }, select: { patientLanguage: true } });
  const lang = u?.patientLanguage ?? "Türkçe";

  const items: ConsentItem[] = await Promise.all(
    REVOCABLE_SCOPES.map(async (scope) => {
      const s = await consentStatus(user.id, scope, SCOPE_VERSION[scope]);
      return { scope, active: s.active, grantedAt: s.grantedAt?.toISOString() ?? null, revokedAt: s.revokedAt?.toISOString() ?? null };
    }),
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--c-accent)]/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent-stronger)]">
        <UserCog size={14} /> Hesabım
      </span>
      <h1 className="aura-display mt-3 text-3xl font-medium tracking-tight text-[var(--c-ink)]">Hesap ayarları</h1>

      <div className="mt-8">
        <ConsentWithdrawPanel lang={consentLangFor(lang)} items={items} />
      </div>

      <div className="mt-8">
        <DeleteAccountPanel lang={lang} retentionYears={RETENTION_YEARS} />
      </div>
    </div>
  );
}
