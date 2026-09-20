"use client";

// Erişim Kaydım (hasta-yüzü) — çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir; burada sunum + çeviri.
// Değiştirilemez append-only hash-zinciri + (test) RFC 3161 zaman damgalı denetim kaydı (lib/audit).
// NOT: personel-yüzü denetçi eşi /denetim TR kalır (konvansiyon: personel panelleri TR; hasta yüzeyi lokalize).
import { useMemo } from "react";
import Link from "next/link";
import { ShieldCheck, Clock, Lock, ChevronDown } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir, LANG_BCP47 } from "@/lib/constants";
import { RES_TR, ROLE_TR } from "@/lib/audit-labels";
import { ACCESS_LOG_LABEL_TEXTS, actionLabel, splitAccessLog, summarizeAccessLog } from "@/lib/access-log-view";
import { useNowMinute } from "@/lib/use-now";
import type { AccessLogEntry } from "@/lib/audit";

// Kontrol raporu H12 (v6.283): önce "kim, ne zaman, neden" özeti; klinik erişimler ana listede; LOGIN gibi teknik
// olaylar "Teknik olaylar" açılır bölümünde (lib/access-log-view). Doğrulama sütunu korunur.
const S = {
  title: "Erişim Kaydım",
  subtitle:
    "Verinize kim, ne zaman, neye eriştiğinin değiştirilemez kaydı. Her satır bir hash-zincirine bağlanır ve zaman damgalanır — sonradan silinemez veya değiştirilemez.",
  summary: "Son {days} günde {total} klinik erişim · doktor {doctor} · siz {you} · diğer {other}",
  summaryNone: "Son {days} günde klinik verinize erişim olmadı.",
  thWhy: "Neden",
  technical: "Teknik olaylar (giriş, hesap güvenliği, zincir)",
  technicalNote: "Bu olaylar klinik verinize erişim değildir; hesabınızın güvenlik izidir.",
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
    () => [...Object.values(S), ...ACCESS_LOG_LABEL_TEXTS, ...Object.values(RES_TR), ...Object.values(ROLE_TR)],
    [],
  );
  const { t } = useT(lang, texts);
  const locale = LANG_BCP47[lang] ?? "tr-TR";
  // "Şimdi" dış kaynaktan (render'da Date.now() yok); sunucuda null → özet hidrasyonda dolar.
  const now = useNowMinute();
  const { clinical, technical } = useMemo(() => splitAccessLog(entries), [entries]);
  const summary = now === null ? null : summarizeAccessLog(entries, now);
  const fill = (tpl: string, s: Record<string, number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(s[k] ?? ""));

  const row = (e: AccessLogEntry) => {
    const verified = e.verification.entryHashValid === true && e.verification.timestampValid === true;
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
            <span className="font-medium">{e.actorRole ? t(ROLE_TR[e.actorRole] ?? e.actorRole) : t(S.system)}</span>
          )}
        </td>
        <td className="px-4 py-2.5">{t(actionLabel(e.action))}</td>
        <td className="px-4 py-2.5 text-[var(--c-ink-2)]">{t(RES_TR[e.resourceType] ?? e.resourceType)}{e.detail ? <span className="block text-[11px] text-[var(--c-ink-3)]">{e.detail}</span> : null}</td>
        <td className="px-4 py-2.5">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-emerald-300"><ShieldCheck size={15} /> {t(S.verified)}</span>
          ) : (
            <span className="text-[var(--c-ink-3)]">—</span>
          )}
        </td>
      </tr>
    );
  };
  const head = (
    <thead className="bg-[var(--c-surface)] text-[var(--c-ink-2)]">
      <tr className="text-start">
        <th className="px-4 py-2.5 font-medium">{t(S.thDate)}</th>
        <th className="px-4 py-2.5 font-medium">{t(S.thWho)}</th>
        <th className="px-4 py-2.5 font-medium">{t(S.thAction)}</th>
        <th className="px-4 py-2.5 font-medium">{t(S.thResource)} · {t(S.thWhy)}</th>
        <th className="px-4 py-2.5 font-medium">{t(S.thVerify)}</th>
      </tr>
    </thead>
  );

  return (
    <main dir={langDir(lang)} lang={locale} className="print-doc mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Lock size={20} className="text-[var(--c-accent-stronger)]" />
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">{t(S.title)}</h1>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-[var(--c-ink-2)]">{t(S.subtitle)}</p>

      {/* Özet (H12): kim · ne zaman — sayılar son 30 günün KLİNİK erişimleri; teknik olaylar sayılmaz. */}
      {summary && (
        <p className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-3 text-sm text-[var(--c-ink)]">
          {summary.total === 0 ? fill(t(S.summaryNone), summary) : fill(t(S.summary), summary)}
        </p>
      )}

      {clinical.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-10 text-center text-sm text-[var(--c-ink-2)]">
          {t(S.empty)}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--c-hairline)]">
          <table className="w-full text-sm">
            {head}
            <tbody className="divide-y divide-white/10">{clinical.map(row)}</tbody>
          </table>
        </div>
      )}

      {/* Teknik olaylar (H12): giriş/hesap güvenliği/zincir — klinik erişim değil; açılır bölümde. */}
      {technical.length > 0 && (
        <details className="group mt-4 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[var(--c-ink-2)]">
            <span>{t(S.technical)} ({technical.length})</span>
            <ChevronDown size={16} className="text-[var(--c-ink-3)] transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-4 pb-2 text-[11px] text-[var(--c-ink-3)]">{t(S.technicalNote)}</p>
          <div className="overflow-hidden border-t border-[var(--c-hairline)]">
            <table className="w-full text-sm">
              {head}
              <tbody className="divide-y divide-white/10">{technical.map(row)}</tbody>
            </table>
          </div>
        </details>
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
