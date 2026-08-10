FROM node:20-alpine

WORKDIR /app

# Copy package files dulu (biar layer ini di-cache Docker selama package.json
# tidak berubah -> install ulang jadi lebih cepat pas rebuild).
COPY package*.json ./
RUN npm install

# Baru copy semua source code.
COPY . .

# Jalankan sebagai user biasa (bukan root) -- image node:alpine sudah
# menyediakan user "node" bawaan. Kalau container ini ke-compromise,
# attacker tidak otomatis dapat akses root di dalam container.
RUN chown -R node:node /app
USER node

EXPOSE 3001

# "npm run dev" pakai `node --watch`, jadi kalau kode di-mount sebagai volume
# (lihat docker-compose.yml di root), perubahan kode langsung ke-reload
# tanpa perlu rebuild image.
CMD ["npm", "run", "dev"]
