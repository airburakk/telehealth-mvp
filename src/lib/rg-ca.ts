// Resmî Gazete (resmigazete.gov.tr) TLS zincir onarımı — GeoTrust ara sertifikası (v6.94, 2026-08-14).
//
// NEDEN: RG sunucusu (Cumhurbaşkanlığı ortak altyapısı — leaf CN=*.tccb.gov.tr, SAN'da
// resmigazete.gov.tr da var) TLS el sıkışmasında YALNIZ leaf sertifikayı sunuyor; issuer'ı
// "GeoTrust TLS RSA CA G1" ara sertifikası zincirde YOK. Tarayıcılar bu eksiği AIA chasing ile
// kendileri tamamlar, Node TAMAMLAMAZ → her RG fetch'i UNABLE_TO_VERIFY_LEAF_SIGNATURE ile düşer
// (2026-08-14 yerel dry-run'da yakalandı; 2026-08-03'te çalışıyordu — sunucu tarafı değişmiş).
// TTB'deki v6.58 vakasının birebir aynısı; aynı desenle onarılır (lib/ttb-ca.ts).
//
// KAYNAK: leaf'in kendi AIA alanındaki resmî adres —
//   http://cacerts.geotrust.com/GeoTrustTLSRSACAG1.crt (DER → PEM).
//   subject: CN=GeoTrust TLS RSA CA G1 (O=DigiCert Inc)
//   issuer : CN=DigiCert Global Root G2  (Node güven deposunda VAR → zincir: leaf → bu ara
//            sertifika → Global Root G2 tamamlanır; 2026-08-14'te rootCertificates'e karşı ölçüldü)
//   geçerlilik: 2017-11-02 → 2027-11-02
//   SHA-256: C0:6E:30:7F:7C:FC:1D:32:FA:72:A4:C0:33:C8:7B:90:01:9A:F2:16:F0:77:5D:64:97:8A:2E:CA:6C:8A:23:0E
//
// ⚠️ RG leaf'i 2026-08-28'de doluyor; yenilemede FARKLI bir ara sertifikaya geçilirse bu onarım
//    işlevsiz kalır ve RG yine UNABLE_TO_VERIFY_LEAF_SIGNATURE ile görünür — o gün buradaki PEM,
//    yeni leaf'in AIA adresinden indirilen sertifikayla değiştirilir (ttb-ca.ts ile aynı kural).
//
// Neden dosya değil TS sabiti: ttb-ca.ts ile aynı gerekçe — PEM'i diskten okumak Vercel bundle
// izleme (outputFileTracingIncludes) bağımlılığı doğurur; sabit ~1,6 KB metin, bundler'a dert yok.
export const RG_INTERMEDIATE_CA = `-----BEGIN CERTIFICATE-----
MIIEjTCCA3WgAwIBAgIQDQd4KhM/xvmlcpbhMf/ReTANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xNzExMDIxMjIzMzdaFw0yNzExMDIxMjIzMzdaMGAxCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xHzAdBgNVBAMTFkdlb1RydXN0IFRMUyBSU0EgQ0EgRzEwggEiMA0GCSqGSIb3
DQEBAQUAA4IBDwAwggEKAoIBAQC+F+jsvikKy/65LWEx/TMkCDIuWegh1Ngwvm4Q
yISgP7oU5d79eoySG3vOhC3w/3jEMuipoH1fBtp7m0tTpsYbAhch4XA7rfuD6whU
gajeErLVxoiWMPkC/DnUvbgi74BJmdBiuGHQSd7LwsuXpTEGG9fYXcbTVN5SATYq
DfbexbYxTMwVJWoVb6lrBEgM3gBBqiiAiy800xu1Nq07JdCIQkBsNpFtZbIZhsDS
fzlGWP4wEmBQ3O67c+ZXkFr2DcrXBEtHam80Gp2SNhou2U5U7UesDL/xgLK6/0d7
6TnEVMSUVJkZ8VeZr+IUIlvoLrtjLbqugb0T3OYXW+CQU0kBAgMBAAGjggFAMIIB
PDAdBgNVHQ4EFgQUlE/UXYvkpOKmgP792PkA76O+AlcwHwYDVR0jBBgwFoAUTiJU
IBiV5uNu5g/6+rkS7QYXjzkwDgYDVR0PAQH/BAQDAgGGMB0GA1UdJQQWMBQGCCsG
AQUFBwMBBggrBgEFBQcDAjASBgNVHRMBAf8ECDAGAQH/AgEAMDQGCCsGAQUFBwEB
BCgwJjAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMEIGA1Ud
HwQ7MDkwN6A1oDOGMWh0dHA6Ly9jcmwzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEds
b2JhbFJvb3RHMi5jcmwwPQYDVR0gBDYwNDAyBgRVHSAAMCowKAYIKwYBBQUHAgEW
HGh0dHBzOi8vd3d3LmRpZ2ljZXJ0LmNvbS9DUFMwDQYJKoZIhvcNAQELBQADggEB
AIIcBDqC6cWpyGUSXAjjAcYwsK4iiGF7KweG97i1RJz1kwZhRoo6orU1JtBYnjzB
c4+/sXmnHJk3mlPyL1xuIAt9sMeC7+vreRIF5wFBC0MCN5sbHwhNN1JzKbifNeP5
ozpZdQFmkCo+neBiKR6HqIA+LMTMCMMuv2khGGuPHmtDze4GmEGZtYLyF8EQpa5Y
jPuV6k2Cr/N3XxFpT3hRpt/3usU/Zb9wfKPtWpoznZ4/44c1p9rzFcZYrWkj3A+7
TNBJE0GmP2fhXhP1D/XVfIW/h0yCJGEiV9Glm/uGOa3DXHlmbAcxSyCRraG+ZBkA
7h4SeM6Y8l/7MBRpPCz6l8Y=
-----END CERTIFICATE-----`;
