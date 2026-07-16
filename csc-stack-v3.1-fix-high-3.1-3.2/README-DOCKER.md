# CSC Dashboard — Full Stack di Docker v3 (tanpa XAMPP)

**Versi ini terpisah total dari `v2`** — nama container, port, dan volume
data semuanya beda, jadi bisa jalan BERBARENGAN dengan `v2` tanpa bentrok,
dan datanya (MySQL, sesi WhatsApp) mulai FRESH BARU, tidak mewarisi apapun
dari `v2`.

Semua service jalan di Docker: MySQL, phpMyAdmin, GOWA (WhatsApp), Backend
(Express), dan Frontend (React/Vite).

## Yang perlu kamu buka di browser (PORT BEDA DARI v2)

| URL | Buat apa |
|---|---|
| http://localhost:5183 | Dashboard (frontend) |
| http://localhost:3011 | Backend API |
| http://localhost:3010 | GOWA — **scan QR code di sini** buat login WhatsApp |
| http://localhost:8091 | phpMyAdmin (login: `root` / isi sesuai `.env`) |

## Struktur folder

```
csc-stack-v3/
├── docker-compose.yml     <- file utama, jalankan compose dari sini
├── db/schema.sql          <- dijalankan otomatis oleh MySQL saat pertama kali start
├── csc-backend/           <- Express API
│   ├── Dockerfile
│   └── .env.example       <- copy jadi .env sebelum run
└── csc-dashboard/         <- React/Vite dashboard
    └── Dockerfile
```

## Cara jalanin (pertama kali)

```bash
cd csc-stack-v3

# 1. Siapkan file .env (WAJIB, di 3 tempat) -- ISI SEMUA PASSWORD/KEY
#    dengan nilai acak, JANGAN pakai contoh di .env.example apa adanya.
cp .env.example .env
cp csc-backend/.env.example csc-backend/.env
cp csc-dashboard/.env.example csc-dashboard/.env

# Generate password/key acak, contoh:
openssl rand -base64 24    # buat MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD
openssl rand -hex 32       # buat BACKEND_API_KEY

# Isi BACKEND_API_KEY dengan NILAI YANG SAMA PERSIS di 3 file:
#   .env                    (BACKEND_API_KEY)
#   csc-backend/.env        (BACKEND_API_KEY)
#   csc-dashboard/.env      (VITE_API_KEY)

# 2. Build & nyalain semua service
docker compose up -d --build

# 3. Cek semua container jalan
docker compose ps
```

Tunggu ~15-30 detik untuk MySQL & GOWA siap sepenuhnya (terutama pertama
kali, karena Docker perlu download image dan build).

**Penting:** buka `http://localhost:3010` dan scan QR dengan WhatsApp kamu
supaya backend bisa benar-benar kirim pesan (bukan mode simulasi). Session
login WhatsApp disimpan di Docker volume, jadi tidak perlu scan ulang tiap
`docker compose restart` — cuma perlu scan ulang kalau volume-nya dihapus
(`docker compose down -v`) atau kamu logout manual.

## Perintah sehari-hari

```bash
docker compose up -d        # nyalain semua (tanpa rebuild)
docker compose down         # matiin semua (data MySQL & sesi WA tetap ada)
docker compose down -v      # matiin semua + HAPUS semua data (reset total)
docker compose logs -f backend    # lihat log backend real-time
docker compose logs -f whatsapp   # lihat log GOWA real-time
docker compose restart backend    # restart 1 service aja
```

## Live-reload / development

- **Backend & frontend** sudah di-mount sebagai volume ke container, jadi
  kalau kamu edit file di `csc-backend/src` atau `csc-dashboard/src`,
  perubahan otomatis kepakai tanpa perlu rebuild image.
- Kalau kamu **nambah/ubah dependency** di `package.json` (backend atau
  frontend), baru perlu rebuild:
  ```bash
  docker compose up -d --build backend
  # atau
  docker compose up -d --build frontend
  ```

## Kalau ada error

```bash
docker compose logs mysql       # MySQL gagal start?
docker compose logs backend     # Backend gagal connect ke DB/GOWA?
docker compose ps               # service mana yang statusnya bukan "running"?
```

## Keamanan (baca sebelum pentest / deploy)

Sudah diterapkan di project ini:
- **Autentikasi API key** (`X-API-Key`) di semua endpoint `/api/*` — WAJIB isi `BACKEND_API_KEY` (backend) & `VITE_API_KEY` (frontend) dengan nilai yang sama sebelum dipentest
- **Rate limiting** — 60 request/menit umum, 10 request/menit khusus `/api/send-message` (mencegah spam WA / brute-force)
- **Helmet** — security headers standar (anti clickjacking, MIME sniffing, dll)
- **CORS dibatasi** — cuma origin yang di-set di `CORS_ORIGIN` yang boleh manggil API
- **Validasi input ketat** — format nomor WA, nama template, dan batas ukuran payload
- **Parameterized query** — aman dari SQL Injection
- **Container non-root** — backend & frontend jalan sebagai user biasa, bukan root
- **Port admin dibatasi localhost** — MySQL (3316), phpMyAdmin (8091), GOWA (3010) cuma bisa diakses dari mesin itu sendiri, tidak ke-expose ke jaringan
- **Error handler global** — error tak terduga (mis. DB down) balik sebagai JSON 500 biasa, **server tidak crash**
- **Password/secret lewat `.env`**, bukan hardcode di `docker-compose.yml`, dan `.gitignore` sudah mencegah `.env` ke-commit ke Git

**Yang PERLU kamu lakukan sendiri sebelum pentest serius:**
1. Ganti semua password contoh di `.env.example` dengan nilai acak asli (jangan pernah pakai `rootpassword` dkk di production)
2. Kalau backend/frontend nanti dideploy ke server dengan IP publik, taruh di belakang reverse proxy (nginx/Caddy) dengan **HTTPS/TLS** — saat ini semua komunikasi masih HTTP polos
3. `BACKEND_API_KEY` yang dipakai frontend browser itu **terlihat di dev tools/network tab** siapapun yang buka dashboard-nya — ini cukup buat menyaring bot/scanner acak, tapi BUKAN pengganti sistem login per-user. Kalau butuh multi-user dengan hak akses berbeda, perlu upgrade ke autentikasi berbasis login (JWT/session)
4. Pertimbangkan matikan/lindungi phpMyAdmin di production (endpoint admin database sebaiknya tidak aktif di server yang bisa diakses luas, meski sudah dibatasi ke localhost)
