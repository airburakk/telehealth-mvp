import { headers, cookies } from "next/headers";
import { db } from "@/lib/db";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { shareState, buildSharedItems, scopeLabel, SHARE_UNLOCK_PREFIX, type SharedItem } from "@/lib/share";
import { ShareUnlock } from "@/components/ShareUnlock";
import {
  Activity, FileText, ScanLine, FlaskConical, Stethoscope,
  ShieldCheck, Clock, Lock, Download, Ban, AlertTriangle, Eye,
} from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_ICON = { report: FileText, image: ScanLine, lab: FlaskConical, note: Stethoscope } as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0E9E97] text-white">
        <Activity size={20} strokeWidth={2.4} />
      </span>
      <span className="leading-tight">
        <span className="block font-bold text-[#0A3F39]">portamed</span>
        <span className="block text-[11px] text-slate-500 -mt-0.5">Güvenli Sağlık Paylaşımı</span>
      </span>
    </div>
  );
}

function StatusScreen({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Shell>
      <Brand />
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">{icon}</div>
        <h1 className="mt-4 text-lg font-bold text-slate-800">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
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

export default async function ShareViewerPage({ params }: { params: Promise<{ token: string }> }) {
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
      body: `${link.recipientName ?? "Alıcı"} · ${link.case.patientName} kayıtları`,
      href: "/paylasimlarim",
    };
    // Vaka sahibi belliyse kişisel; değilse rol yayını (eski vakalar)
    if (link.case.userId) await notifyUser(link.case.userId, accessNotif);
    else await notifyRoles(["PATIENT"], accessNotif);
  }

  const scopes = link.scopes.split(",");
  const items = buildSharedItems(link.case, scopes);
  const expiryLabel = link.expiresAt
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(link.expiresAt)
    : "Süresiz";

  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <Brand />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <Eye size={12} /> Yalnız görüntüleme
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0E9E97] text-white"><ShieldCheck size={22} /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#0A3F39]">{link.case.patientName} — sağlık kayıtları</h1>
            <p className="text-sm text-slate-500">
              {link.recipientName ? `${link.recipientName} ile paylaşıldı` : "Sizinle paylaşıldı"} · Branş: {link.case.branch}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Clock size={13} /> Erişim: {expiryLabel}</span>
          <span className="inline-flex items-center gap-1">
            {link.allowDownload ? <><Download size={13} /> İndirme açık</> : <><Lock size={13} /> İndirme kapalı</>}
          </span>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> Erişiminiz kayıt altına alınır</span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((it, i) => {
          const Icon = KIND_ICON[it.kind];
          const dl = link.allowDownload ? itemDownload(it) : null;
          return (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                  <Icon size={16} className="text-[#0A3F39]" /> {it.title}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">{scopeLabel(it.scope)}</span>
                </div>
                {dl && (
                  <a download={dl.name} href={dl.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#0A3F39] hover:underline">
                    <Download size={13} /> İndir
                  </a>
                )}
              </div>

              <div className="p-5">
                {(it.kind === "report" || it.kind === "note") && (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{it.body}</pre>
                )}

                {it.kind === "lab" && it.rows && (
                  <table className="w-full text-sm">
                    <tbody>
                      {it.rows.map((r, j) => (
                        <tr key={j} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-4 text-slate-600">{r.k}</td>
                          <td className="py-2 text-right font-medium text-slate-800">{r.v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {it.kind === "image" && (
                  <div className="rounded-xl bg-slate-900 p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1"><ScanLine size={12} /> {it.fileName}</span>
                      <span>DICOM görüntüleyici</span>
                    </div>
                    <div className="mt-2 grid aspect-video place-items-center rounded-lg bg-gradient-to-br from-slate-800 to-black">
                      <div className="text-center">
                        <ScanLine size={40} className="mx-auto text-slate-600" />
                        <p className="mt-2 text-xs text-slate-500">Görüntü önizleme (demo)</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">Gerçek DICOM render + güvenli dosya depolama üretim sürümünde eklenecek.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-white/60 p-4 text-[11px] text-slate-500">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          Bu içerik hastanın açık izniyle, sınırlı süreyle ve yalnızca görüntüleme amacıyla paylaşılmıştır.
          Hasta erişimi istediği an iptal edebilir; her görüntüleme denetim kaydına (audit trail) işlenir. · portamed (MVP)
        </p>
      </div>
    </Shell>
  );
}
