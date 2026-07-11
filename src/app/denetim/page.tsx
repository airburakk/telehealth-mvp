import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Clock, Link2, ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getChainAudit } from "@/lib/audit";
import { verifyConsentChain } from "@/lib/consent";
import { ACTION_TR, RES_TR, ROLE_TR } from "@/lib/audit-labels";

export const dynamic = "force-dynamic";

// Denetim İzi Bütünlüğü — denetçi (ADMIN / Etik Kurul) görünümü: KÜRESEL erişim hash-zincirinin bütünlüğü
// + en güncel kayıtların metadata'sı. Klinik içerik göstermez (yalnız kim/ne-zaman/hangi-kayıt + mühür).
// Hasta-yüzü eşi: /erisim-kaydi (yalnız kendi verisi).

const AUDITOR_ROLES = ["ETHICS", "ADMIN"];
const short = (s: string | null, head = 8, tail = 0) =>
  !s ? "—" : s.length <= head + tail + 1 ? s : tail ? `${s.slice(0, head)}…${s.slice(-tail)}` : `${s.slice(0, head)}…`;

export default async function DenetimPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/denetim");
  if (!AUDITOR_ROLES.includes(user.role)) redirect("/"); // proxy de korur — derinlemesine savunma

  const sp = await searchParams;
  const requestedPage = parseInt(sp.page ?? "1", 10); // getChainAudit içinde aralığa sıkıştırılır (NaN→1)
  const [{ integrity, entries, total, page, pageSize, totalPages }, consentChain] = await Promise.all([
    getChainAudit({ page: requestedPage }),
    verifyConsentChain(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Link2 size={20} className="text-[#17919E]" />
        <h1 className="text-2xl font-semibold text-slate-900">Denetim İzi Bütünlüğü</h1>
      </div>
      <p className="text-sm text-slate-600 max-w-3xl">
        Klinik veriye yapılan tüm anlamlı erişimin <strong>değiştirilemez küresel kaydı</strong>. Her satır bir
        önceki kaydın mührüne (hash) bağlanır ve zaman damgalanır — sonradan silme, araya ekleme veya değiştirme
        bağımsız olarak tespit edilebilir. Bu görünüm yalnız <strong>metadata</strong> içerir (kim · ne zaman ·
        hangi kayıt); klinik içerik gösterilmez.
      </p>

      {/* Küresel bütünlük rozeti — tüm zincir taranır */}
      {integrity.ok ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800">Zincir bütün</p>
            <p className="text-sm text-emerald-700">
              {integrity.count} mühürlü kayıt doğrulandı (GENESIS → … → uç). Araya silme/değiştirme/ekleme tespit
              edilmedi. <span className="text-emerald-600/80">(Uçtan-kesme tespiti harici çapa gerektirir — gerçek
              RFC 3161 TSA park kapsamında.)</span>
            </p>
            <p className="mt-1 text-xs text-emerald-700/90">
              Mühür kompozisyonu: {integrity.v2Count} × v2 (anahtarlı HMAC) · {integrity.v1Count} × v1 (tarihî,
              anahtarsız){integrity.unsealedCount > 0 ? ` · ${integrity.unsealedCount} mühürsüz tarihî kayıt (zincir kapsamı dışında)` : ""}.
              {integrity.v2Count === 0 ? " ⚠️ v2 canlıya alındıktan sonra hiç v2 kaydı görünmüyorsa zincir yeniden yazılmış olabilir — araştırın." : ""}
            </p>
            {integrity.unverifiableSeals > 0 && (
              <p className="mt-1 text-sm font-medium text-amber-700">
                ⚠️ {integrity.unverifiableSeals} kaydın mührü bu ortamın anahtarıyla doğrulanamadı (farklı anahtar
                kimliği). Üretimde bu sayı 0 olmalıdır — değilse araştırın.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <ShieldAlert size={22} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold text-rose-800">Zincir bütünlüğü BOZUK</p>
            <p className="text-sm text-rose-700">
              {integrity.count} kayıt tarandı; ilk kırılma kaydı: <code className="font-mono">{integrity.brokenAt}</code>.
              Bu noktadan itibaren silme/değiştirme/çatallanma olmuş olabilir.
            </p>
          </div>
        </div>
      )}

      {/* Onam zinciri bütünlüğü — aynı mühür şeması (consent.verifyConsentChain) tek satır özet */}
      <p className={`mt-2 flex items-center gap-1.5 text-xs ${consentChain.ok ? "text-slate-500" : "font-medium text-rose-600"}`}>
        {consentChain.ok ? <ShieldCheck size={13} className="text-emerald-500" /> : <ShieldAlert size={13} />}
        Onam zinciri: {consentChain.ok
          ? `bütün (${consentChain.count} kayıt · ${consentChain.v2Count} v2 / ${consentChain.v1Count} v1${consentChain.unverifiableSeals > 0 ? ` · ⚠️ ${consentChain.unverifiableSeals} farklı-anahtar` : ""})`
          : `BOZUK — ilk kırılma: ${consentChain.brokenAt}`}
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
          Henüz kayıtlı erişim yok.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Tarih</th>
                <th className="px-4 py-2.5 font-medium">Aktör</th>
                <th className="px-4 py-2.5 font-medium">İşlem</th>
                <th className="px-4 py-2.5 font-medium">Kaynak</th>
                <th className="px-4 py-2.5 font-medium">Konu (hasta)</th>
                <th className="px-4 py-2.5 font-medium">Mühür (prev → entry)</th>
                <th className="px-4 py-2.5 font-medium">Doğrulama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => {
                // Üç durum: doğrulandı (yeşil) · kesin bozuk (kırmızı) · karar verilemez (gri —
                // mühürsüz tarihî kayıt veya başka ortamın anahtarı; banner sayaçları bağlam verir).
                const verified =
                  e.verification.entryHashValid === true && e.verification.timestampValid === true;
                const brokenSeal =
                  e.verification.entryHashValid === false || e.verification.timestampValid === false;
                return (
                  <tr key={e.id} className="text-slate-700 align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                      {new Date(e.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{e.actorRole ? ROLE_TR[e.actorRole] ?? e.actorRole : "Sistem"}</span>
                      {e.actorId && <span className="block font-mono text-[11px] text-slate-400">{short(e.actorId)}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {ACTION_TR[e.action] ?? e.action}
                      {e.detail && <span className="block text-xs text-slate-400">{e.detail}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {RES_TR[e.resourceType] ?? e.resourceType}
                      <span className="block font-mono text-[11px] text-slate-400">{short(e.resourceId)}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{short(e.subjectUserId)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {short(e.prevHash, 6)} <span className="text-slate-300">→</span> {short(e.entryHash, 10)}
                    </td>
                    <td className="px-4 py-2.5">
                      {verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <ShieldCheck size={15} /> Doğrulandı
                        </span>
                      ) : brokenSeal ? (
                        <span className="inline-flex items-center gap-1 text-rose-500">
                          <ShieldAlert size={15} /> Bozuk mühür
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400" title="Mühürsüz tarihî kayıt veya başka ortamın anahtarı — bozukluk kanıtı değil">
                          <ShieldAlert size={15} /> Karar verilemez
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sayfalama — 200+ kayıtta denetçi tüm zinciri (sayfa sayfa) gezebilir. İlk sayfa en güncel kayıtlar. */}
      {totalPages > 1 && (
        <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Denetim kaydı sayfaları">
          <span className="text-xs text-slate-500">
            Toplam <strong className="text-slate-700">{total}</strong> kayıt · Sayfa{" "}
            <strong className="text-slate-700">{page}</strong> / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/denetim?page=${page - 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft size={15} /> Önceki
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-1.5 text-sm font-medium text-slate-300 cursor-not-allowed">
                <ChevronLeft size={15} /> Önceki
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/denetim?page=${page + 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Sonraki <ChevronRight size={15} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-1.5 text-sm font-medium text-slate-300 cursor-not-allowed">
                Sonraki <ChevronRight size={15} />
              </span>
            )}
          </div>
        </nav>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Clock size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          <strong className="text-slate-600">Mühür, sıralama &amp; zaman damgası:</strong> her kayıt bir önceki
          kaydın mührüne bağlanır; yazımlar küresel bir kilit altında <em>sıralanır</em> (eşzamanlı erişimde bile
          zincir çatallanmaz). Tablo her sayfada en çok {pageSize} kaydı (en güncelden eskiye) gösterir ve
          sayfalanır; <strong>bütünlük taraması ise her görünümde tüm zinciri</strong> kapsar.
          Zaman damgası şu an mekanizma-doğrulama amaçlı <em>simüle</em> (SIMULATED-LOCAL); üretimde bağımsız
          RFC 3161 otoritesine (freeTSA / TÜBİTAK BİLGEM) takılacak. Hasta kendi kaydını{" "}
          <Link href="/erisim-kaydi" className="text-[#17919E] hover:underline">Erişim Kaydım</Link>’dan görür.
        </p>
      </div>
    </main>
  );
}
