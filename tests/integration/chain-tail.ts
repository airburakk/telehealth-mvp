// Zincir temizliğinin SAF parçası (DB yok → birim testi tests/unit/chain-cleanup-tail.test.ts).
// Hash-zincirinden (audit AccessLog · onam ConsentRecord) satır silmek yalnız ZİNCİRİN UCUNDAN güvenlidir: ortadaki
// bir satır silinirse ondan sonrakinin prevHash'i boşa düşer (yetim) ve zincir KALICI kırılır. Bu yüzden silinecek
// küme = uçtan geriye yürüyüp yalnız BENİM olan bitişik satırlar; araya yabancı bir satır girdiyse yürüyüş orada
// durur, ondan önceki kendi satırlarım bırakılır (zararsız kalıntı — sonraki koşular bunu zaten kabul eder).
//
// 2026-10-04 olayı: iki CI koşusu aynı test branch'inde üst üste bindi; eski "uç benimse HEPSİNİ sil" kuralı,
// araya giren öteki koşunun ACCOUNT_DELETE satırlarını yetim bıraktı (benim r1 · yabancı f(prev=r1) · benim r2 · r3=uç
// → hepsi silinince f yetim) → her sonraki entegrasyon koşusu kırmızı.
//
// `tipFirst`: zincirin ucundan geriye doğru (createdAt/grantedAt DESC, id DESC) okunmuş satır id'leri.
export function ownContiguousTail(tipFirst: readonly { id: string }[], mine: ReadonlySet<string>): string[] {
  const tail: string[] = [];
  for (const r of tipFirst) {
    if (!mine.has(r.id)) break;
    tail.push(r.id);
  }
  return tail;
}
