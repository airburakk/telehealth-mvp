# Kart-render servisi — Playwright resmi imajı (Chromium hazır); npm playwright sürümü imaj
# etiketiyle AYNI olmalı (uyumsuzluk "browser not found" verir).
# v6.320: + ffmpeg (hikâye/Reels MP4; noble = 6.1, kullanılan her bayrak standart) · lib/ (sosyal iş yöneticisi + video üretici)
# · assets/ (küre + vuruş ızgarası) · tools/ (üretilen MP4'leri Instagram şartlarına karşı doğrulayan betik).
# Müzik İMAJA GİRMEZ: compose volume'u `./kart-varlik:/varlik:ro` (README) — dağıtımda kaybolmaz, lisans/boyut repo dışında kalır.
# 2026-11-15: + karusel v3 çizicisi (karusel/render.py): python3-pil + libraqm0 (RAQM olmadan kapanış kartının piksel kilidi
# tutmaz) + paketin varsayılan yollarındaki yazı tipleri (/usr/share/fonts/opentype/urw-base35 · /usr/share/fonts/truetype/dejavu).
FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pil libraqm0 fonts-urw-base35 fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
RUN npm init -y >/dev/null && npm i --no-audit --no-fund playwright@1.55.0 >/dev/null
COPY server.mjs .
COPY lib ./lib
COPY assets ./assets
COPY tools ./tools
COPY karusel ./karusel
ENV NODE_ENV=production
CMD ["node", "server.mjs"]
