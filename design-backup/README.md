# Tasarım Yedekleri

Eski tasarıma geri dönüş noktaları (yeni tasarım: `design_handoff_portamed_landing/` spesifikasyonu).

## Klasik tasarım (v2.6 ve öncesi — lacivert AIR hero + 7 modül kartı)

İki geri dönüş yolu:

1. **Dosya kopyası:** `anasayfa-klasik-v2.6.tsx.bak` → içeriği `src/app/page.tsx`'e geri kopyala
   (ayrıca `Header.tsx`/`SiteFooter.tsx`'teki ana sayfa gizleme koşullarını kaldır).
2. **Git etiketi (tam durum):** `git checkout design-klasik-v2.6 -- src/app/page.tsx src/components/Header.tsx src/app/layout.tsx`
   (etiket: v2.6 sonrası, PortaMed öncesi son commit)
