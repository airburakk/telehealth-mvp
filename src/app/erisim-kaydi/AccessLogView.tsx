"use client";

// Erişim Kaydım (hasta-yüzü) — çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir; burada sunum + çeviri.
// Değiştirilemez append-only hash-zinciri + (test) RFC 3161 zaman damgalı denetim kaydı (lib/audit).
// NOT: personel-yüzü denetçi eşi /denetim TR kalır (konvansiyon: personel panelleri TR; hasta yüzeyi lokalize).
import { useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, Clock, Lock } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir, LANG_BCP47 } from "@/lib/constants";
import { ACTION_TR, RES_TR, ROLE_TR } from "@/lib/audit-labels";
import type { AccessLogEntry } from "@/lib/audit";

const S = {
  title: "Erişim Kaydım",
  subtitle:
    "Verinize kim, ne zaman, neye eriştiğinin değiştirilemez kaydı. Her satır bir hash-zincirine bağlanır ve zaman damgalanır — sonradan silinemez veya değiştirilemez.",
  thDate: "Tarih",
  thWho: "Kim",
  thAction: "İşlem",
  thResource: "Kaynak",
  thVerify: "Doğrulama",
  empty: "Verinize henüz kayıtlı bir erişim yok. Bir doktor başvurunuzu görüntülediğinde burada görünür.",
  you: "Siz",
  system: "Sistem",
  verified: "Doğrulandı",
  footerLead: "Mühür & zaman damgası:",
  footerBody:
    "her kayıt bir önceki kaydın mührüne (hash) bağlanır → araya ekleme/silme tespit edilebilir. Zaman damgası şu an mekanizma-doğrulama amaçlı simüle (SIMULATED-LOCAL); üretimde bağımsız RFC 3161 otoritesine takılacak. Yüksek-frekanslı teknik olaylar (sinyal/poll, arayüz çevirisi) kasıtlı olarak kaydedilmez.",
  proofPrefix: "Onam ispatınız için",
  proofLink: "Onay Kanıtım",
} as const;

export function AccessLogView({ entries }: { entries: AccessLogEntry[] }) {
  const [lang, setLang] = usePatientLang();
  // ⚠️ texts MEMOIZE edilmeli — yoksa her render effect'i yeniden kurar, uçuştaki çeviri fetch'i iptal olur (v2.68 dersi).
  const texts = useMemo(
    () => [...Object.values(S), ...Object.values(ACTION_TR), ...Object.values(RES_TR), ...Object.values(ROLE_TR)],
    [],
  );
  const { t } = useT(lang, texts);
  const locale = LANG_BCP47[lang] ?? "tr-TR";

  return (
    <main dir={langDir(lang)} className="print-doc mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Lock size={20} className="text-[var(--c-accent-stronger)]" />
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">{t(S.title)}</h1>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-[var(--c-ink-2)]">{t(S.subtitle)}</p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-10 text-center text-sm text-[var(--c-ink-2)]">
          {t(S.empty)}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--c-hairline)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--c-surface)] text-[var(--c-ink-2)]">
              <tr className="text-start">
                <th className="px-4 py-2.5 font-medium">{t(S.thDate)}</th>
                <th className="px-4 py-2.5 font-medium">{t(S.thWho)}</th>
                <th className="px-4 py-2.5 font-medium">{t(S.thAction)}</th>
                <th className="px-4 py-2.5 font-medium">{t(S.thResource)}</th>
                <th className="px-4 py-2.5 font-medium">{t(S.thVerify)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {entries.map((e) => {
                const verified =
                  e.verification.entryHashValid === true && e.verification.timestampValid === true;
                return (
                  <tr key={e.id} className="text-[var(--c-ink)]">
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--c-ink-2)]">
                      {new Date(e.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.actorIsYou ? (
                        <span className="inline-flex items-center rounded-full bg-[var(--c-accent-stronger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--c-accent-stronger)]">
                          {t(S.you)}
                        </span>
                      ) : (
                        <span className="font-medium">
                          {e.actorRole ? t(ROLE_TR[e.actorRole] ?? e.actorRole) : t(S.system)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{t(ACTION_TR[e.action] ?? e.action)}</td>
                    <td className="px-4 py-2.5 text-[var(--c-ink-2)]">{t(RES_TR[e.resourceType] ?? e.resourceType)}</td>
                    <td className="px-4 py-2.5">
                      {verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <ShieldCheck size={15} /> {t(S.verified)}
                        </span>
                      ) : (
                        <span className="text-[var(--c-ink-3)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3 text-xs text-[var(--c-ink-2)]">
        <Clock size={15} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
        <p>
          <strong className="text-[var(--c-ink-2)]">{t(S.footerLead)}</strong> {t(S.footerBody)} {t(S.proofPrefix)}{" "}
          <Link href="/onam/kanit" className="text-[var(--c-accent-stronger)] hover:underline">
            {t(S.proofLink)}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
