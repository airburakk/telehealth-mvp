// JSON-LD script etiketi (vitrinden taşındı). Sözleşme: json MODÜL-DÜZEYİ
// sabit dize olmalı (kullanıcı girdisi asla girmez — XSS yüzeyi kapalı).
export function StructuredData({ json }: { json: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
