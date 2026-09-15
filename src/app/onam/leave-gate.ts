import { isSafeInternalPath } from "@/lib/safe-path";

// Onam kapısından ÇIKIŞ = TAM SAYFA gezintisi (2026-09-15 — üretimde ölçülen "onaydan sonra sayfa döngüye giriyor").
//
// Eskiden `router.push(dest); router.refresh()` idi. ÜRETİMDE (dev'de değil: <Link> ön-yükleme yalnız üretimde açık) şu
// zincir kuruluyordu: /onam'daki Header rolün kapılı rotalarını <Link> ile ön-yükler; o anda çerezdeki `cv` bayat olduğu
// için proxy her ön-yüklemeyi 307 ile `/onam?next=…`e çevirir ve istemci yönlendirici bu yanıtı ÖN-YÜKLEME ÖNBELLEĞİNE
// yazar. Onay sonrası /api/consent çerezi tazeler ama router.push(dest) o bayat girdiyi kullanır → yine /onam →
// ConsentResign → yeniden imza → router.replace(dest) → yine bayat girdi… Kullanıcı "Onay durumunuz doğrulanıyor…"
// spinner'ında elle yenileyene kadar kalır. `next start` ile 2026-09-15'te birebir tekrarlandı (ağ kaydında
// /onam?next=%2Fdoktor… ön-yükleme girdileri + ikinci POST /api/consent). Tam sayfa yükleme = yeni çerezle yeni belge
// isteği + boş yönlendirici/ön-yükleme önbelleği → döngü kurulamaz. Hedef site-içi olmalı (sayfa zaten süzer; burada
// ikinci kez doğrulanır — açık yönlendirme).
// Regresyon nöbeti: tests/unit/safe-path.test.ts ("onam kapıları router.push kullanmaz").
export function leaveConsentGate(dest: string, mode: "push" | "replace" = "push"): void {
  const target = isSafeInternalPath(dest) ? dest : "/";
  if (mode === "replace") window.location.replace(target);
  else window.location.assign(target);
}
