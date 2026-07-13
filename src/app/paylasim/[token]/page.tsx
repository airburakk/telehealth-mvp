import { headers, cookies } from "next/headers";
import { db } from "@/lib/db";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { shareState, buildSharedItems, scopeLabel, SHARE_UNLOCK_PREFIX, type SharedItem } from "@/lib/share";
import { ShareUnlock } from "@/components/ShareUnlock";
import { ShareLangSelect } from "@/components/ShareLangSelect";
import { getTranslations, translateClinical } from "@/lib/i18n";
import { LANGUAGES, langDir } from "@/lib/constants";
import { decryptField, decryptCaseFields } from "@/lib/crypto";
import {
  Activity, FileText, ScanLine, FlaskConical, Stethoscope,
  ShieldCheck, Clock, Lock, Download, Ban, AlertTriangle, Eye,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // alıcının dilinde ilk (cache'siz) çeviri ~10s sürebilir — serverless timeout payı

const KIND_ICON = { report: FileText, image: ScanLine, lab: FlaskConical, note: Stethoscope } as const;

function Shell({ children, dir = "ltr" }: { children: React.ReactNode; dir?: "ltr" | "rtl" }) {
  return (
    <div className="min-h-screen bg-[var(--c-ink)]/10">
      <div dir={dir} className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}

function Brand({ subtitle = "Güvenli Sağlık Paylaşımı" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]">
        <Activity size={20} strokeWidth={2.4} />
      </span>
      <span className="leading-tight">
        <span className="block font-bold text-[var(--c-ink)]">AURA</span>
        <span className="block text-[11px] text-[var(--c-ink-2)] -mt-0.5">{subtitle}</span>
      </span>
    </div>
  );
}

function StatusScreen({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Shell>
      <Brand />
      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-[var(--c-ink)]/10 text-[var(--c-ink-2)]">{icon}</div>
        <h1 className="mt-4 text-lg font-bold text-[var(--c-ink)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">{desc}</p>
      </div>
    </Shell>
  );
}

function itemDownload(it: SharedItem): { href: string; name: string } | null {
  if (it.kind === "report" || it.kind === "note") {
    return { href: `data:text/plain;charset=utf-8,${encodeURIComponent(it.body || "")}`, name: `${it.scope.toLowerCase()}.txt` };
  }
  if (it.kind === "lab" && it.rows) {
    const txt = it.rows.map((r) => `${r.k}: ${r.v}`).join("\n");
    return { href: `data:text/plain;charset=utf-8,${encodeURIComponent(txt)}`, name: "laboratuvar.txt" };
  }
  return null;
}

export default async function ShareViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;

  const link = await db.shareLink.findUnique({
    where: { token },
    include: { case: { include: { consultations: { orderBy: { startedAt: "desc" } } } } },
  });

  if (!link) {
    return <StatusScreen icon={<Ban size={26} />} title="Bağlantı bulunamadı" desc="Bu paylaşım bağlantısı geçersiz veya kaldırılmış." />;
  }

  const st = shareState(link);
  if (st === "REVOKED") {
    return <StatusScreen icon={<Ban size={26} />} title="Erişim iptal edildi" desc="Hasta bu paylaşımı sonlandırdı. Kayıtlar artık görüntülenemez." />;
  }
  if (st === "EXPIRED") {
    return <StatusScreen icon={<Clock size={26} />} title="Bağlantının süresi doldu" desc="Bu paylaşımın erişim süresi sona erdi. Lütfen hastadan yeni bir bağlantı isteyin." />;
  }

  // Şifre kapısı
  if (link.passwordHash) {
    const ck = await cookies();
    const unlocked = ck.get(`${SHARE_UNLOCK_PREFIX}${link.id}`)?.value === "1";
    if (!unlocked) {
      return (
        <Shell>
          <Brand />
          <div className="mt-6">
            <ShareUnlock id={link.id} recipient={link.recipientName} />
          </div>
        </Shell>
      );
    }
  }

  // Erişimi denetim izine kaydet (audit + hasta bildirimi) — 30 sn içindeki tekrarları birleştir
  const last = await db.shareAccess.findFirst({ where: { shareLinkId: link.id }, orderBy: { createdAt: "desc" } });
  if (!last || Date.now() - last.createdAt.getTime() > 30_000) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    await db.shareAccess.create({
      data: { shareLinkId: link.id, action: "VIEW", ip, userAgent: h.get("user-agent")?.slice(0, 300) || null },
    });
    const accessNotif = {
      type: "SHARE_ACCESS" as const,
      title: "👁 Sağlık paylaşımınız görüntülendi",
      body: `${link.recipientName ?? "Alıcı"} kaydınızı görüntüledi`, // isim bildirime gömülmez (E2EE inc.2c)
      href: "/paylasimlarim",
    };
    // Vaka sahibi belliyse kişisel; değilse rol yayını (eski vakalar)
    if (link.case.userId) await notifyUser(link.case.userId, accessNotif);
    else await notifyRoles(["PATIENT"], accessNotif);
  }

  const scopes = link.scopes.split(",");
  // Epikriz + SOAP notları at-rest şifreli → alıcıya gösterilecek/çevrilecek içerik için çöz.
  const caseForShare = {
    ...decryptCaseFields(link.case),
    dischargeReport: decryptField(link.case.dischargeReport),
    consultations: link.case.consultations.map((co) => ({ ...co, notes: decryptField(co.notes) })),
  };
  const items = buildSharedItems(caseForShare, scopes);

  // Alıcının dili (?lang) — çeviri SUNUCUDA (girişsiz görüntüleyici, /api/i18n auth gerektirir).
  // TR'de kimlik döner (anında, maliyetsiz); diğer dillerde tek Claude çağrısı → Translation tablosunda cache'lenir.
  const sp = await searchParams;
  const lang = LANGUAGES.includes(String(sp?.lang)) ? String(sp.lang) : "Türkçe";

  const UI = [
    "Güvenli Sağlık Paylaşımı", "Yalnız görüntüleme", "sağlık kayıtları", "Sizinle paylaşıldı",
    "Branş", "Erişim", "Süresiz", "İndirme açık", "İndirme kapalı",
    "Erişiminiz kayıt altına alınır", "İndir", "DICOM görüntüleyici", "Görüntü önizleme (demo)",
    "Gerçek DICOM render + güvenli dosya depolama üretim sürümünde eklenecek.",
    "Bu içerik hastanın açık izniyle, sınırlı süreyle ve yalnızca görüntüleme amacıyla paylaşılmıştır. Hasta erişimi istediği an iptal edebilir; her görüntüleme denetim kaydına (audit trail) işlenir. · AURA (MVP)",
  ];
  const splitParas = (s: string) => s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  // Önbelleklenebilir (PHI değil): UI + branş + kalem başlıkları + scope etiketleri + lab satırları
  // (LOINC ad/değer — yapısal, tanımlayıcı değil). Bunlar Translation tablosunda cache'lenir (paylaşımlar arası tekrar).
  const content: string[] = [link.case.branch];
  // Klinik serbest-metin (PHI — epikriz/SOAP + "Hasta: ad" + anlatı): ÖNBELLEKLENMEZ + ad AI'dan gizlenir (P0 #2).
  const clinical: string[] = [];
  for (const it of items) {
    content.push(it.title, scopeLabel(it.scope));
    if (it.body) clinical.push(...splitParas(it.body)); // uzun klinik metni paragraf paragraf çevir (granülarite)
    if (it.rows) for (const r of it.rows) content.push(r.k, r.v);
  }
  const [uiMap, clinMap] = await Promise.all([
    getTranslations(lang, [...UI, ...content]),
    translateClinical(lang, clinical, caseForShare.patientName), // önbelleksiz + ad maskeli
  ]);
  const tmap = { ...uiMap, ...clinMap };
  const t = (s: string) => (s ? tmap[s.trim()] ?? s : s);
  const tBody = (s: string) => splitParas(s).map((p) => t(p)).join("\n\n");

  const expiryDate = link.expiresAt
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(link.expiresAt)
    : null;

  return (
    <Shell dir={langDir(lang)}>
      <div className="flex items-center justify-between gap-3">
        <Brand subtitle={t("Güvenli Sağlık Paylaşımı")} />
        <div className="flex items-center gap-2">
          <ShareLangSelect current={lang} />
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25 sm:inline-flex">
            <Eye size={12} /> {t("Yalnız görüntüleme")}
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><ShieldCheck size={22} /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--c-ink)]">{caseForShare.patientName} — {t("sağlık kayıtları")}</h1>
            <p className="text-sm text-[var(--c-ink-2)]">
              {link.recipientName ?? t("Sizinle paylaşıldı")} · {t("Branş")}: {t(link.case.branch)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--c-hairline)] pt-3 text-xs text-[var(--c-ink-2)]">
          <span className="inline-flex items-center gap-1"><Clock size={13} /> {t("Erişim")}: {expiryDate ?? t("Süresiz")}</span>
          <span className="inline-flex items-center gap-1">
            {link.allowDownload ? <><Download size={13} /> {t("İndirme açık")}</> : <><Lock size={13} /> {t("İndirme kapalı")}</>}
          </span>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> {t("Erişiminiz kayıt altına alınır")}</span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((it, i) => {
          const Icon = KIND_ICON[it.kind];
          const dl = link.allowDownload ? itemDownload(it) : null;
          return (
            <div key={i} className="overflow-hidden rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--c-hairline)] px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
                  <Icon size={16} className="text-[var(--c-ink)]" /> {t(it.title)}
                  <span className="rounded-full bg-[var(--c-ink)]/10 px-2 py-0.5 text-[11px] font-normal text-[var(--c-ink-2)]">{t(scopeLabel(it.scope))}</span>
                </div>
                {dl && (
                  <a download={dl.name} href={dl.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--c-ink)] hover:underline">
                    <Download size={13} /> {t("İndir")}
                  </a>
                )}
              </div>

              <div className="p-5">
                {(it.kind === "report" || it.kind === "note") && (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--c-ink)]">{tBody(it.body || "")}</pre>
                )}

                {it.kind === "lab" && it.rows && (
                  <table className="w-full text-sm">
                    <tbody>
                      {it.rows.map((r, j) => (
                        <tr key={j} className="border-b border-[var(--c-hairline)] last:border-0">
                          <td className="py-2 pe-4 text-[var(--c-ink-2)]">{t(r.k)}</td>
                          <td className="py-2 text-end font-medium text-[var(--c-ink)]">{t(r.v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {it.kind === "image" && (
                  <div className="rounded-2xl bg-[var(--c-bg-deep)] p-3">
                    <div className="flex items-center justify-between text-[11px] text-[var(--c-ink-3)]">
                      <span className="inline-flex items-center gap-1"><ScanLine size={12} /> {it.fileName}</span>
                      <span>{t("DICOM görüntüleyici")}</span>
                    </div>
                    <div className="mt-2 grid aspect-video place-items-center rounded-lg bg-gradient-to-br from-slate-800 to-black">
                      <div className="text-center">
                        <ScanLine size={40} className="mx-auto text-[var(--c-ink-2)]" />
                        <p className="mt-2 text-xs text-[var(--c-ink-2)]">{t("Görüntü önizleme (demo)")}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-[var(--c-ink-2)]">{t("Gerçek DICOM render + güvenli dosya depolama üretim sürümünde eklenecek.")}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-ink)]/5 p-4 text-[11px] text-[var(--c-ink-2)]">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
        <p>{t("Bu içerik hastanın açık izniyle, sınırlı süreyle ve yalnızca görüntüleme amacıyla paylaşılmıştır. Hasta erişimi istediği an iptal edebilir; her görüntüleme denetim kaydına (audit trail) işlenir. · AURA (MVP)")}</p>
      </div>
    </Shell>
  );
}
