import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookMarked, ArrowLeft, ChevronLeft, ChevronRight, UserRound, Building2,
  Search, Plane, BadgeCheck, Languages, Award,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["COORDINATOR", "ADMIN"];
const PAGE_SIZE = 50; // dizin tarama sayfası — lojistik/denetim deseninden daha yoğun liste

// JSON string kolonu (languages/accreditations) → string dizisi (bozuk/boş → [])
function parseNames(s: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
}

// HealthTürkiye Kayıt Defteri tarayıcısı (S2 koordinatör + ADMIN) — günlük senkronla dolan
// RegistryDoctor/RegistryHospital dizinini aranabilir/sayfalı listeler. /admin/registry-raporu
// yalnız günlük DEĞİŞİKLİKLERİ gösterir; bu sayfa dizinin kendisini tarar. Kamuya açık dizin
// verisi (PHI yok) ama personel yüzeyi → TR-sabit, proxy /operasyon kapısı + sayfa öz-savunması.
export default async function RegistryBrowserPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; sehir?: string; brans?: string; tur?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/operasyon/kayit-defteri");
  if (!STAFF_ROLES.includes(user.role)) redirect("/"); // proxy de korur — derinlemesine savunma

  const sp = await searchParams;
  const tab = sp.tab === "tesis" ? "tesis" : "doktor";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sehir = (sp.sehir ?? "").trim().slice(0, 60);
  const brans = (sp.brans ?? "").trim().slice(0, 80);
  const tur = (sp.tur ?? "").trim().slice(0, 80);

  // Üst istatistik + son senkron durumu (rapor sayfasındaki sayaçların eşleniği)
  const [activeDoctors, activeHospitals, lastReport] = await Promise.all([
    db.registryDoctor.count({ where: { removedAt: null } }),
    db.registryHospital.count({ where: { removedAt: null } }),
    db.registryReport.findFirst({ orderBy: { date: "desc" }, select: { date: true, status: true } }),
  ]);

  // Sekmeye göre filtre + sayfa verisi
  let total = 0;
  let page = 1;
  let totalPages = 1;
  let doctorRows: { id: number; name: string; lastName: string; jobName: string | null; branchName: string | null; establishmentName: string | null; cityName: string | null; experience: number | null }[] = [];
  let hospitalRows: { id: number; name: string; cityName: string | null; cityHasAirport: boolean | null; facilityTypeName: string | null; doctorCount: number | null; totalPersonnel: number | null; languages: string | null; accreditations: string | null; authorizationNumber: string | null }[] = [];
  let branchOptions: string[] = [];
  let cityOptions: string[] = [];
  let typeOptions: string[] = [];

  if (tab === "doktor") {
    // Serbest metin: her kelime ad/soyad/kurum alanlarından birinde geçmeli ("Ahmet Yılmaz" → ad+soyad)
    const tokens = q.split(/\s+/).filter(Boolean).slice(0, 4);
    const where = {
      removedAt: null,
      ...(sehir ? { cityName: sehir } : {}),
      ...(brans ? { branchName: brans } : {}),
      AND: tokens.map((t) => ({
        OR: [
          { name: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
          { establishmentName: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    };
    total = await db.registryDoctor.count({ where });
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, parseInt(sp.page ?? "1", 10) || 1), totalPages);
    [doctorRows, branchOptions, cityOptions] = await Promise.all([
      db.registryDoctor.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { name: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, name: true, lastName: true, jobName: true, branchName: true, establishmentName: true, cityName: true, experience: true },
      }),
      db.registryDoctor.findMany({ where: { removedAt: null, branchName: { not: null } }, distinct: ["branchName"], select: { branchName: true }, orderBy: { branchName: "asc" } })
        .then((r) => r.map((x) => x.branchName!).filter(Boolean)),
      db.registryDoctor.findMany({ where: { removedAt: null, cityName: { not: null } }, distinct: ["cityName"], select: { cityName: true }, orderBy: { cityName: "asc" } })
        .then((r) => r.map((x) => x.cityName!).filter(Boolean)),
    ]);
  } else {
    const where = {
      removedAt: null,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(sehir ? { cityName: sehir } : {}),
      ...(tur ? { facilityTypeName: tur } : {}),
    };
    total = await db.registryHospital.count({ where });
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, parseInt(sp.page ?? "1", 10) || 1), totalPages);
    [hospitalRows, typeOptions, cityOptions] = await Promise.all([
      db.registryHospital.findMany({
        where,
        orderBy: [{ doctorCount: "desc" }, { name: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, name: true, cityName: true, cityHasAirport: true, facilityTypeName: true,
          doctorCount: true, totalPersonnel: true, languages: true, accreditations: true, authorizationNumber: true,
        },
      }),
      db.registryHospital.findMany({ where: { removedAt: null, facilityTypeName: { not: null } }, distinct: ["facilityTypeName"], select: { facilityTypeName: true }, orderBy: { facilityTypeName: "asc" } })
        .then((r) => r.map((x) => x.facilityTypeName!).filter(Boolean)),
      db.registryHospital.findMany({ where: { removedAt: null, cityName: { not: null } }, distinct: ["cityName"], select: { cityName: true }, orderBy: { cityName: "asc" } })
        .then((r) => r.map((x) => x.cityName!).filter(Boolean)),
    ]);
  }

  // Sayfalama bağlantıları mevcut filtreleri korur
  const qs = (p: number) => {
    const u = new URLSearchParams();
    u.set("tab", tab);
    if (q) u.set("q", q);
    if (sehir) u.set("sehir", sehir);
    if (brans) u.set("brans", brans);
    if (tur) u.set("tur", tur);
    if (p > 1) u.set("page", String(p));
    return `/operasyon/kayit-defteri?${u.toString()}`;
  };
  const filtered = Boolean(q || sehir || brans || tur);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link href="/operasyon" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Operasyon Paneli
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><BookMarked size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-ink)]">HealthTürkiye Kayıt Defteri</h1>
          <p className="text-sm text-[var(--c-ink-2)]">
            healthturkiye.gov.tr doktor + tesis dizini — {activeDoctors.toLocaleString("tr-TR")} doktor · {activeHospitals.toLocaleString("tr-TR")} tesis
            {lastReport && <> · son senkron {lastReport.date}{lastReport.status !== "OK" && <span className="font-semibold text-amber-300"> ({lastReport.status})</span>}</>}
          </p>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="mt-5 inline-flex rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-1 text-sm font-medium">
        <Link href="/operasyon/kayit-defteri?tab=doktor" className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 ${tab === "doktor" ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"}`}>
          <UserRound size={15} /> Doktorlar
        </Link>
        <Link href="/operasyon/kayit-defteri?tab=tesis" className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 ${tab === "tesis" ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"}`}>
          <Building2 size={15} /> Tesisler
        </Link>
      </div>

      {/* Arama + filtre (GET formu — istemci JS'siz çalışır) */}
      <form method="GET" action="/operasyon/kayit-defteri" className="mt-4 flex flex-wrap items-end gap-2 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
        <input type="hidden" name="tab" value={tab} />
        <label className="min-w-52 flex-1">
          <span className="text-xs font-medium text-[var(--c-ink-2)]">{tab === "doktor" ? "Ad, soyad veya kurum" : "Tesis adı"}</span>
          <input name="q" defaultValue={q} placeholder={tab === "doktor" ? "ör. Ahmet Yılmaz / Acıbadem" : "ör. Maslak"}
            className="mt-1 w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]" />
        </label>
        {/* Doktor kayıtlarında cityName kaynakta boş → filtre yalnız veri varsa gösterilir */}
        {cityOptions.length > 0 && (
          <label>
            <span className="text-xs font-medium text-[var(--c-ink-2)]">Şehir</span>
            <select name="sehir" defaultValue={sehir} className="mt-1 block w-44 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="">Tümü</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        {tab === "doktor" ? (
          <label>
            <span className="text-xs font-medium text-[var(--c-ink-2)]">Branş</span>
            <select name="brans" defaultValue={brans} className="mt-1 block w-56 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="">Tümü</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        ) : (
          <label>
            <span className="text-xs font-medium text-[var(--c-ink-2)]">Tesis türü</span>
            <select name="tur" defaultValue={tur} className="mt-1 block w-56 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="">Tümü</option>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-[var(--c-bg)] hover:opacity-90">
          <Search size={15} /> Ara
        </button>
        {filtered && (
          <Link href={`/operasyon/kayit-defteri?tab=${tab}`} className="rounded-lg px-3 py-2 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
            Temizle
          </Link>
        )}
      </form>

      {/* Sonuçlar */}
      <p className="mt-4 text-xs text-[var(--c-ink-2)]">
        <strong className="text-[var(--c-ink)]">{total.toLocaleString("tr-TR")}</strong> kayıt{filtered ? " (filtreli)" : ""} · yalnız dizinde halen kayıtlı olanlar
        {user.role === "ADMIN" // günlük rapor sayfası ADMIN/ETHICS kapılı — koordinatöre kırık bağlantı gösterme
          ? <> (çıkarılanlar <Link href="/admin/registry-raporu" className="text-[var(--c-accent-stronger)] underline-offset-2 hover:underline">günlük raporlarda</Link>)</>
          : " (çıkarılanlar günlük senkron raporlarında saklanır)"}
      </p>

      {total === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-sm text-[var(--c-ink-3)]">
          Kayıt bulunamadı{filtered ? " — filtreleri gevşetmeyi deneyin" : " — dizin ilk senkronla dolar"}.
        </div>
      ) : tab === "doktor" ? (
        <div className="mt-3 overflow-x-auto rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-[var(--c-hairline)] text-left text-xs uppercase tracking-wide text-[var(--c-ink-3)]">
                <th className="px-4 py-3 font-semibold">Doktor</th>
                <th className="px-4 py-3 font-semibold">Branş</th>
                <th className="px-4 py-3 font-semibold">Kurum</th>
                {/* Şehir: filtreyle aynı veri-kapısı — senkron dolumu (v5.5) çalışana dek gizli kalır */}
                {cityOptions.length > 0 && <th className="px-4 py-3 font-semibold">Şehir</th>}
              </tr>
            </thead>
            <tbody>
              {doctorRows.map((d) => (
                <tr key={d.id} className="border-b border-[var(--c-hairline)] last:border-0 hover:bg-[var(--c-surface)]/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[var(--c-ink)]">{d.name} {d.lastName}</div>
                    <div className="text-xs text-[var(--c-ink-3)]">{d.jobName ?? "—"}{d.experience ? ` · ${d.experience} yıl` : ""}</div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--c-ink-2)]">{d.branchName ?? "—"}</td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-[var(--c-ink-2)]" title={d.establishmentName ?? undefined}>{d.establishmentName ?? "—"}</td>
                  {cityOptions.length > 0 && <td className="px-4 py-2.5 text-[var(--c-ink-2)]">{d.cityName ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {hospitalRows.map((h) => {
            const langs = parseNames(h.languages);
            const accs = parseNames(h.accreditations);
            return (
              <div key={h.id} className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--c-ink)]">{h.name}</span>
                      {h.authorizationNumber && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--c-accent)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/25">
                          <BadgeCheck size={11} /> {h.authorizationNumber}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--c-ink-2)]">
                      {h.cityName ?? "—"}{h.cityHasAirport && <Plane size={11} className="ml-1 inline text-[var(--c-ink-3)]" aria-label="havalimanı var" />}
                      {h.facilityTypeName && <> · {h.facilityTypeName}</>}
                      {h.doctorCount != null && <> · {h.doctorCount.toLocaleString("tr-TR")} doktor</>}
                      {h.totalPersonnel != null && <> · {h.totalPersonnel.toLocaleString("tr-TR")} personel</>}
                    </div>
                  </div>
                </div>
                {(langs.length > 0 || accs.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {langs.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[var(--c-ink-3)]"><Languages size={11} /></span>
                    )}
                    {langs.slice(0, 6).map((l) => (
                      <span key={l} className="rounded-full bg-[var(--c-ink)]/10 px-2 py-0.5 text-[var(--c-ink-2)]">{l}</span>
                    ))}
                    {langs.length > 6 && <span className="text-[var(--c-ink-3)]">+{langs.length - 6}</span>}
                    {accs.length > 0 && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[var(--c-ink-3)]"><Award size={11} /></span>
                    )}
                    {accs.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300 ring-1 ring-amber-400/20">{a}</span>
                    ))}
                    {accs.length > 4 && <span className="text-[var(--c-ink-3)]">+{accs.length - 4}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sayfalama — /denetim deseni */}
      {totalPages > 1 && (
        <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Kayıt defteri sayfaları">
          <span className="text-xs text-[var(--c-ink-2)]">
            Sayfa <strong className="text-[var(--c-ink)]">{page}</strong> / {totalPages.toLocaleString("tr-TR")}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={qs(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
                <ChevronLeft size={15} /> Önceki
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-3)]">
                <ChevronLeft size={15} /> Önceki
              </span>
            )}
            {page < totalPages ? (
              <Link href={qs(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
                Sonraki <ChevronRight size={15} />
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-3)]">
                Sonraki <ChevronRight size={15} />
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
