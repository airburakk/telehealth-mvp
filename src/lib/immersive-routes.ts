// Görüşme (video) rotaları IMMERSIVE tam-ekran çalışır: video+panel viewport'un
// tamamını (100dvh) doldurur → global Header/SiteFooter bu rotalarda gizlenir.
// Tek kaynak: hem Header hem SiteFooter buradan okur (drift önlenir).
//
// Kapsam (3 video bileşeni · 4 kulvar + konsültasyon):
//   /gorusme/[id]                              → ConsultationRoom (triyaj/genel + ücretsiz sağlık + sağlık turizmi)
//   /second-opinion/gorusme/[appointmentId]    → SoVideoRoom (İkinci Görüş)
//   /konsultasyon/gorusme/[id]                 → ConsultVideoRoom (partner↔doktor konsültasyon)
export function isImmersiveCallPath(pathname: string): boolean {
  return (
    pathname.startsWith("/gorusme/") ||
    pathname.startsWith("/second-opinion/gorusme/") ||
    pathname.startsWith("/konsultasyon/gorusme/")
  );
}
