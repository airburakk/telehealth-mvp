import { listFamilyMedicineSourceChecks } from "@/lib/family-medicine-refresh-store";

const labels = {
  unchecked: "Henüz kontrol edilmedi",
  baseline: "İlk teknik karşılaştırma kaydı alındı",
  current: "Son karşılaştırmada içerik değişmedi",
  changed: "Kaynak değişti; yeniden inceleme gerekli",
  unreachable: "Kaynağa ulaşılamadı",
} as const;
const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value))
  : "Henüz yok";

/** Technical observations only. A successful HTTP request is not a clinical review. */
export async function FamilyMedicineSourceStatus() {
  let report: Awaited<ReturnType<typeof listFamilyMedicineSourceChecks>>;
  try { report = await listFamilyMedicineSourceChecks(); }
  catch {
    return <section className="mt-8 border-t border-[var(--c-hairline)] pt-6" aria-label="Kaynak kontrol durumu">
      <h2 className="text-lg font-semibold">Kaynak kontrol durumu alınamadı</h2>
      <p className="mt-2 text-sm">Kontrol kayıtlarına şu anda erişilemiyor. Kaynakları güncel veya incelenmiş kabul etmeyin; resmî sürümü ayrıca doğrulayın.</p>
    </section>;
  }
  const reviewNeeded = report.sources.filter(source => source.status === "changed");
  const accessProblems = report.sources.filter(source => source.status === "unreachable" || source.stale);
  return <section className="mt-8 border-t border-[var(--c-hairline)] pt-6" aria-labelledby="family-source-watch">
    <h2 id="family-source-watch" className="aura-display text-xl font-medium tracking-tight">Kaynak güncelleme takibi</h2>
    <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-ink-2)]">Bu raftaki belgeler ile seçili resmî mevzuat, ilaç duyurusu ve dernek sayfaları her gün 06.10 Türkiye saati için planlanan teknik kontrolde karşılaştırılır. Değişiklik veya erişim sorunu inceleme gerektirir. Liste değişikliği, etkinlik tarihinin veya yeni hükmün otomatik onaylandığı anlamına gelmez. İçeriğin değişmemesi, yürürlükte veya klinik olarak onaylı olduğunu göstermez. Son başarılı erişim 72 saati geçtiğinde kontrol bayat sayılır.</p>
    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <div><dt className="font-semibold">Son tamamlanan kontrol koşusu (TR)</dt><dd>{dateLabel(report.lastRunAt)}</dd></div>
      <div><dt className="font-semibold">Son kaynak erişim denemesi (TR)</dt><dd>{dateLabel(report.lastAttemptAt)}</dd></div>
    </dl>
    <p className="mt-3 text-sm" role="status">İzlenen kaynak: {report.sources.length} · Değişiklik kaydı: {reviewNeeded.length} · Erişim veya tazelik sorunu: {accessProblems.length}</p>
    <ul className="mt-4 divide-y divide-[var(--c-hairline)]">
      {report.sources.map(source => <li key={source.sourceKey} className="py-3 text-[13px]">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">{source.title} ↗</a>
        <p className="mt-1">{labels[source.status]}{source.stale ? " · Teknik kontrol bayat" : ""}</p>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">Son deneme: {dateLabel(source.checkedAt)} · Son başarılı erişim: {dateLabel(source.lastSuccessAt)}{source.changedAt ? ` · Değişiklik: ${dateLabel(source.changedAt)}` : ""}</p>
      </li>)}
    </ul>
    <p className="mt-4 text-xs leading-relaxed text-[var(--c-ink-2)]">Akademik yayınlar mevcut PubMed, Europe PMC ve DOAJ toplama akışlarını; hukuk ve etkinlikler kendi Doctorium akışlarını kullanır. TİTCK geri çekme ve blokaj duyuruları resmî RSS üzerinden mevcut günlük haber toplamasına eklenir. TAHUD ve AHEF sayfa değişiklikleri inceleme sinyalidir; etkinlik tarihi otomatik oluşturulmaz. Bu kontrol yeni mevzuatın tamamını keşfetmez, tüm kongreleri veya ilaç güncellemelerini kapsamaz; eski yayınların ve AI özetlerinin baştan incelendiği anlamına gelmez. Hekim ve hukuk incelemesi teknik kontrolden ayrıdır.</p>
  </section>;
}
