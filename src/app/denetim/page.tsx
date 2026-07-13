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
        <Link2 size={20} className="text-[var(--c-accent-stronger)]" />
        <h1 className="text-2xl font-semibold text-[var(--c-ink)]">Denetim İzi Bütünlüğü</h1>
      </div>
      <p className="text-sm text-[var(--c-ink-2)] max-w-3xl">
        Klinik veriye yapılan tüm anlamlı erişimin <strong>değiştirilemez küresel kaydı</strong>. Her satır bir
        önceki kaydın mührüne (hash) bağlanır ve zaman damgalanır — sonradan silme, araya ekleme veya değiştirme
        bağımsız olarak tespit edilebilir. Bu görünüm yalnız <strong>metadata</strong> içerir (kim · ne zaman ·
        hangi kayıt); klinik içerik gösterilmez.
      </p>

      {/* Küresel bütünlük rozeti — tüm zincir taranır */}
      {integrity.ok ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-4">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-300" />
          <div>
            <p className="font-semibold text-emerald-200">Zincir bütün</p>
            <p className="text-sm text-emerald-300">
              {integrity.count} mühürlü kayıt doğrulandı (GENESIS → … → uç). Araya silme/değiştirme/ekleme tespit
              edilmedi. <span className="text-emerald-300/80">(Uçtan-kesme tespiti harici çapa gerektirir — gerçek
              RFC 3161 TSA park kapsamında.)</span>
            </p>
            <p className="mt-1 text-xs text-emerald-300">
              Mühür kompozisyonu: {integrity.v2Count} × v2 (anahtarlı HMAC) · {integrity.v1Count} × v1 (tarihî,
              anahtarsız){integrity.unsealedCount > 0 ? ` · ${integrity.unsealedCount} mühürsüz tarihî kayıt (zincir kapsamı dışında)` : ""}.
              {integrity.v2Count === 0 ? " ⚠️ v2 canlıya alındıktan sonra hiç v2 kaydı görünmüyorsa zincir yeniden yazılmış olabilir — araştırın." : ""}
            </p>
            {integrity.unverifiableSeals > 0 && (
              <p className="mt-1 text-sm font-medium text-amber-300">
                ⚠️ {integrity.unverifiableSeals} kaydın mührü bu ortamın anahtarıyla doğrulanamadı (farklı anahtar
                kimliği). Üretimde bu sayı 0 olmalıdır — değilse araştırın.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-5 py-4">
          <ShieldAlert size={22} className="mt-0.5 shrink-0 text-rose-300" />
          <div>
            <p className="font-semibold text-rose-200">Zincir bütünlüğü BOZUK</p>
            <p className="text-sm text-rose-300">
              {integrity.count} kayıt tarandı; ilk kırılma kaydı: <code className="font-mono">{integrity.brokenAt}</code>.
              Bu noktadan itibaren silme/değiştirme/çatallanma olmuş olabilir.
            </p>
          </div>
        </div>
      )}

      {/* Onam zinciri bütünlüğü — aynı mühür şeması (consent.verifyConsentChain) tek satır özet */}
      <p className={`mt-2 flex items-center gap-1.5 text-xs ${consentChain.ok ? "text-[var(--c-ink-2)]" : "font-medium text-rose-300"}`}>
        {consentChain.ok ? <ShieldCheck size={13} className="text-emerald-500" /> : <ShieldAlert size={13} />}
        Onam zinciri: {consentChain.ok
          ? `bütün (${consentChain.count} kayıt · ${consentChain.v2Count} v2 / ${consentChain.v1Count} v1${consentChain.unverifiableSeals > 0 ? ` · ⚠️ ${consentChain.unverifiableSeals} farklı-anahtar` : ""})`
          : `BOZUK — ilk kırılma: ${consentChain.brokenAt}`}
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-10 text-center text-sm text-[var(--c-ink-2)]">
          Henüz kayıtlı erişim yok.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--c-hairline)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--c-surface)] text-[var(--c-ink-2)]">
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
            <tbody className="divide-y divide-white/10">
              {entries.map((e) => {
                // Üç durum: doğrulandı (yeşil) · kesin bozuk (kırmızı) · karar verilemez (gri —
                // mühürsüz tarihî kayıt veya başka ortamın anahtarı; banner sayaçları bağlam verir).
                const verified =
                  e.verification.entryHashValid === true && e.verification.timestampValid === true;
                const brokenSeal =
                  e.verification.entryHashValid === false || e.verification.timestampValid === false;
                return (
                  <tr key={e.id} className="text-[var(--c-ink)] align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--c-ink-2)]">
                      {new Date(e.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{e.actorRole ? ROLE_TR[e.actorRole] ?? e.actorRole : "Sistem"}</span>
                      {e.actorId && <span className="block font-mono text-[11px] text-[var(--c-ink-3)]">{short(e.actorId)}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {ACTION_TR[e.action] ?? e.action}
                      {e.detail && <span className="block text-xs text-[var(--c-ink-3)]">{e.detail}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--c-ink-2)]">
                      {RES_TR[e.resourceType] ?? e.resourceType}
                      <span className="block font-mono text-[11px] text-[var(--c-ink-3)]">{short(e.resourceId)}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--c-ink-3)]">{short(e.subjectUserId)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--c-ink-2)] whitespace-nowrap">
                      {short(e.prevHash, 6)} <span className="text-[var(--c-ink-3)]">→</span> {short(e.entryHash, 10)}
                    </td>
                    <td className="px-4 py-2.5">
                      {verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <ShieldCheck size={15} /> Doğrulandı
                        </span>
                      ) : brokenSeal ? (
                        <span className="inline-flex items-center gap-1 text-rose-500">
                          <ShieldAlert size={15} /> Bozuk mühür
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--c-ink-3)]" title="Mühürsüz tarihî kayıt veya başka ortamın anahtarı — bozukluk kanıtı değil">
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
          <span className="text-xs text-[var(--c-ink-2)]">
            Toplam <strong className="text-[var(--c-ink)]">{total}</strong> kayıt · Sayfa{" "}
            <strong className="text-[var(--c-ink)]">{page}</strong> / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/denetim?page=${page - 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
              >
                <ChevronLeft size={15} /> Önceki
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-3)] cursor-not-allowed">
                <ChevronLeft size={15} /> Önceki
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/denetim?page=${page + 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
              >
                Sonraki <ChevronRight size={15} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-3)] cursor-not-allowed">
                Sonraki <ChevronRight size={15} />
              </span>
            )}
          </div>
        </nav>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3 text-xs text-[var(--c-ink-2)]">
        <Clock size={15} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
        <p>
          <strong className="text-[var(--c-ink-2)]">Mühür, sıralama &amp; zaman damgası:</strong> her kayıt bir önceki
          kaydın mührüne bağlanır; yazımlar küresel bir kilit altında <em>sıralanır</em> (eşzamanlı erişimde bile
          zincir çatallanmaz). Tablo her sayfada en çok {pageSize} kaydı (en güncelden eskiye) gösterir ve
          sayfalanır; <strong>bütünlük taraması ise her görünümde tüm zinciri</strong> kapsar.
          Zaman damgası şu an mekanizma-doğrulama amaçlı <em>simüle</em> (SIMULATED-LOCAL); üretimde bağımsız
          RFC 3161 otoritesine (freeTSA / TÜBİTAK BİLGEM) takılacak. Hasta kendi kaydını{" "}
          <Link href="/erisim-kaydi" className="text-[var(--c-accent-stronger)] hover:underline">Erişim Kaydım</Link>’dan görür.
        </p>
      </div>
    </main>
  );
}
