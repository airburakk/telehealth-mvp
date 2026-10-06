// İçerik takvimi — boş taslak iskeleti (v6.328, 2026-10-06). SAF (yalnız TİP içe aktarmaları → çalışma zamanı bağımlılığı yok; istemci de kullanır).
// Üreticisiz rubrikte (etkinlik radarı · öğrenci köşesi) ilk kayıt: rubriğin slayt rollerinde boş slaytlar.
import type { PlanPayload } from "./payload";
import type { SeriesDef } from "./series";

export function skeletonPayload(series: SeriesDef): PlanPayload {
  return { v: 1, slides: series.slideRoles.map((role) => ({ role, title: "", body: "" })), caption: "", hashtags: [], sources: [] };
}
