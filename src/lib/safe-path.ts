// Site-içi güvenli yol denetimi (açık-yönlendirme koruması) — SAF ve importsuz: client bileşen, server, proxy
// ve route handler'lardan aynı kural kullanılır (lib/oauth isSafeNextPath buna devreder).
//
// Kabul: "/" ile başlayan tek bir site-içi yol (sorgu/çapa serbest). RED: "//host" (protokol-göreli = başka origin) ve
// "/\host" — tarayıcılar özel şemalarda ters bölüyü bölü sayar, "/\evil.com" da "//evil.com"a çözülür. 2026-09-15: onam
// kapısı çıkışı tam sayfa gezintisine (window.location) geçince `next` hedefi doğrudan tarayıcıya verilir oldu; kontrol o
// yüzden bu ikinci biçimi de kapsayacak şekilde sıkılaştırıldı (test: tests/unit/safe-path.test.ts).
export function isSafeInternalPath(p: string | undefined | null): p is string {
  return typeof p === "string" && p.startsWith("/") && !/^\/[\/\\]/.test(p);
}
