"use client";

// Paylaşım Kontrol Merkezi (hasta-yüzü) — çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir;
// burada dil seçimi + başlık + erişim bildirimleri + ShareManager (form/liste). Desen: AccessLogView.
import { useMemo } from "react";
import { ShieldCheck, BellRing, Eye } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir, LANG_BCP47 } from "@/lib/constants";
import { ShareManager, type CaseOpt, type LinkData } from "@/components/ShareManager";

interface UnseenAccess { id: string; when: string; recipient: string | null; caseName: string }

const S = {
  title: "Paylaşım Kontrol Merkezi",
  subtitle: "Sağlık verilerinizi kendi kontrolünüzde — süreli ve istediğiniz an iptal edilebilir bağlantılarla paylaşın.",
  notif: "Yeni erişim bildirimi",
  viewedRecord: "kaydınızı görüntüledi",
  sharedPerson: "Paylaşılan kişi",
} as const;

export function SharesView({ unseen, cases, links }: { unseen: UnseenAccess[]; cases: CaseOpt[]; links: LinkData[] }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => Object.values(S), []);
  const { t } = useT(lang, texts);
  const locale = LANG_BCP47[lang] ?? "tr-TR";

  return (
    <main dir={langDir(lang)} className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[#101010]">{t(S.title)}</h1>
            <p className="text-sm text-slate-500">{t(S.subtitle)}</p>
          </div>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      {unseen.length > 0 && (
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <BellRing size={16} /> {t(S.notif)} ({unseen.length})
          </div>
          <ul className="mt-2 space-y-1">
            {unseen.slice(0, 5).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-2 text-sm text-amber-900">
                <Eye size={14} className="shrink-0" />
                <span>
                  <strong>{u.recipient || t(S.sharedPerson)}</strong>, {u.caseName} {t(S.viewedRecord)}
                </span>
                <span className="text-amber-600">· {new Date(u.when).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <ShareManager lang={lang} cases={cases} links={links} />
      </div>
    </main>
  );
}
