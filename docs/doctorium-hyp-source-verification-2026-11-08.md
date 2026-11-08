# HYP source revision verification, 2026-11-08

## Verified public provenance

The official HSGM version page, https://hsgm.saglik.gov.tr/tr/ah-tarama-takip, links the following PDF with the label identifying the 1 May 2026 update:

https://hsgm.saglik.gov.tr/depo/birimler/aile-hekimligi-uygulama-ve-gelistirme-db/Dokumanlar/Rehberler/HYP_TARAMA_VE_TAKIP_KILAVUZU_14042026.pdf

Local public HTTPS verification on 2026-11-08 returned HTTP 200, application/pdf, 9,256,227 bytes and 220 pages. SHA256:

5034982664cc871c8589bbdb7df516107afe1dc3a4aa17b57dbe2a4e5022263f

The official version page also links the 01.05.2026 update approval document and 06.04.2026 distribution letter. The version-page label and its target were checked; no clinical eligibility, treatment, payment, or legal rule was approved or extracted for execution.

## Superseded directory link and rejected fallback candidates

The former directory target ended in `/Yonerge/Ek_Hastalik_Yonetim_Platformu_HYP_Tarama_ve_Takip_Kilavuzu_1.pdf`. It is 146 pages and 4,751,847 bytes (SHA256 085e58126179e318c7b8707aace5a9e92350feda27dd4faaf74dd933a11bfe0b). It is not the currently linked 220-page revision and must not be presented as a same-version fallback.

The second HSGM PDF at https://hsgm.saglik.gov.tr/depo/HASTALIK_YONETIM_PLATFORMU_HYP_TARAMA_VE_TAKIP_KULAVUZU.pdf is also 146 pages, with a different full-file hash and different extracted text. It is not an equivalent fallback.

The official Erzurum page https://erzurumism.saglik.gov.tr/TR-301681/6hastalik-yonetim-platformu-hyp.html links https://dosyaism.saglik.gov.tr/Eklenti/212607/0/hastalik-tonetim-platformu-kilavuzupdf.pdf. That is a different 6-page document about Healthy Life Centre workflows, not the 220-page HYP guide. It was rejected as a fallback.

No equivalent, current, independently hosted official mirror was established. No fallback to older material was configured. Network, access-control, challenge, certificate, or content-validation failures continue to fail closed.

## Implementation boundaries

- The directory now points to the official May 2026 PDF and separately monitors the official version page, including its meaningful document links. A future new PDF URL can therefore create a review signal rather than remaining invisible at an unchanged old URL.
- Both entries retain pending clinical review. The observed version label is not clinical or legal approval.
- The new canonical URL produces a new source identity. Existing source history is retained, not relabelled as a successful check of the new release.
- Only HYP receives a fixed 12 MiB body limit because the verified PDF exceeds 8 MiB. All other sources retain 8 MiB. The 12-second request budget, trusted HTTPS redirects and no-user-URL restriction remain unchanged.
- A successful local request does not prove reachability from Vercel. Production must run its own cron check after deployment before claiming the previous network error is resolved.