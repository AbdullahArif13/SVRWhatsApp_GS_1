# Dokumentasi Instalasi — CSC Dashboard v3.1 (fix High 3.1–3.2)

Panduan ini berlaku untuk **instalasi di mana saja**: laptop pribadi (Windows/Mac/Linux),
maupun **server/VPS** (Ubuntu, dsb). Stack ini 100% jalan di Docker, jadi caranya sama
di semua tempat — bedanya hanya di bagian **akses dari luar** (lihat Bagian 6).

> Catatan: file `README-DOCKER.md` bawaan project ini masih menyebut MySQL & phpMyAdmin —
> itu dokumentasi versi lama (v3). Versi yang kamu punya sekarang (**v3.1**) sudah pindah
> ke **PostgreSQL** dan **tidak ada phpMyAdmin lagi**. Dokumen ini mengikuti `docker-compose.yml`
> yang sebenarnya (sumber kebenaran paling akurat).

---

## 1. Arsitektur singkat

| Service | Isinya | Port host (default) |
|---|---|---|
| `postgres` | Database PostgreSQL 16 | 127.0.0.1:5443 |
| `whatsapp` | GOWA (go-whatsapp-web-multidevice) — jembatan ke WhatsApp | 127.0.0.1:3020 |
| `backend` | Express API (Node.js) | 127.0.0.1:3021 |
| `frontend` | React/Vite dashboard | 127.0.0.1:5193 |

Semua port di atas **sengaja dibatasi ke `127.0.0.1`** (localhost) demi keamanan —
artinya secara default hanya bisa diakses dari mesin Docker itu sendiri, baik itu
laptop kamu maupun server. Cara mengaksesnya dari luar dijelaskan di Bagian 6.

---

## 2. Prasyarat

Instal di mesin (laptop **atau** server) yang akan menjalankan stack ini:

1. **Docker Engine** + **Docker Compose plugin** (v2)
   - Linux/server: `curl -fsSL https://get.docker.com | sh`
   - Windows/Mac: instal **Docker Desktop**
   - Cek: `docker --version` dan `docker compose version`
2. Nomor **WhatsApp aktif** yang akan discan sebagai perangkat pengirim.
3. (Khusus server) Akses `sudo`/root dan minimal 1–2 GB RAM kosong.

---

## 3. Ambil source code

```bash
# kalau dapat dalam bentuk .zip, extract dulu
unzip csc-stack-v3_1-fix-high-3_1-3_2.zip -d csc-stack
cd csc-stack
```

Struktur folder yang harus ada:

```
csc-stack/
├── docker-compose.yml
├── .env.example
├── db/schema.sql
├── csc-backend/        (Express API)
│   └── .env.example
└── csc-dashboard/      (React/Vite)
    └── .env.example
```

---

## 4. Konfigurasi environment (WAJIB, 3 file)

Stack ini **tidak akan menyala** kalau env belum diisi (`backend` sengaja *fail-closed*
kalau `BACKEND_API_KEY` kosong). Siapkan 3 file `.env`:

```bash
cp .env.example .env
cp csc-backend/.env.example csc-backend/.env
cp csc-dashboard/.env.example csc-dashboard/.env
```

Generate nilai acak yang kuat:

```bash
openssl rand -base64 24    # untuk POSTGRES_PASSWORD
openssl rand -hex 32       # untuk BACKEND_API_KEY
openssl rand -hex 32       # untuk WHATSAPP_WEBHOOK_SECRET
```

### 4.1 `.env` (root)

```ini
POSTGRES_DB=csc_dashboard
POSTGRES_USER=csc_user
POSTGRES_PASSWORD=<isi_password_acak>

BACKEND_API_KEY=<isi_key_acak_panjang>
WHATSAPP_WEBHOOK_SECRET=<isi_secret_acak_panjang>
```

### 4.2 `csc-backend/.env`

Field penting yang wajib diisi/samakan (field lain boleh default):

```ini
PORT=3001
BACKEND_API_KEY=<SAMA PERSIS dengan BACKEND_API_KEY di root .env>
WHATSAPP_WEBHOOK_SECRET=<SAMA PERSIS dengan WHATSAPP_WEBHOOK_SECRET di root .env>
CORS_ORIGIN=http://localhost:5193
```

> `GOWA_BASE_URL` dan `DB_HOST` di file ini **otomatis di-override** oleh
> `docker-compose.yml` (jadi `http://whatsapp:3000` dan `postgres`) selama kamu
> menjalankan lewat `docker compose up`. Nilai di `.env` cuma dipakai kalau
> backend dijalankan langsung tanpa Docker (lihat Bagian 8).

### 4.3 `csc-dashboard/.env`

```ini
VITE_API_BASE_URL=http://localhost:3021/api
VITE_API_KEY=<SAMA PERSIS dengan BACKEND_API_KEY di atas>
```

> ⚠️ Kalau dashboard diakses dari domain/IP server (bukan `localhost`), ganti
> `VITE_API_BASE_URL` sesuai domain publik backend-nya (lihat Bagian 6).
> Ingat: nilai `VITE_API_KEY` **akan terlihat** siapa saja lewat browser dev tools —
> fungsinya cuma menyaring bot/scanner acak, bukan pengganti login user.

**Checklist sebelum lanjut:** `BACKEND_API_KEY` harus identik di 2 tempat (`.env` root
& `csc-backend/.env`, sekaligus jadi `VITE_API_KEY` di `csc-dashboard/.env`).
`WHATSAPP_WEBHOOK_SECRET` harus identik di 2 tempat (`.env` root & `csc-backend/.env`).

---

## 5. Build & jalankan

```bash
docker compose up -d --build
docker compose ps        # pastikan semua status "running"/"healthy"
```

Tunggu ~15–30 detik di percobaan pertama (Postgres init + build image).

### 5.1 Scan QR WhatsApp (wajib, sekali saja)

Buka GOWA (lihat Bagian 6 untuk cara akses kalau di server) lalu scan QR dengan
HP yang nomornya mau dipakai mengirim pesan. Sesi login tersimpan di Docker
volume — tidak perlu scan ulang setiap restart, kecuali:
- volume dihapus (`docker compose down -v`), atau
- logout manual dari WhatsApp di HP.

---

## 6. Cara mengakses — lokal vs server

### 6.1 Di laptop sendiri (development)

Langsung buka:
- Dashboard: `http://localhost:5193`
- Backend API: `http://localhost:3021`
- GOWA (scan QR): `http://localhost:3020`

### 6.2 Di server, tapi kamu akses via SSH (cara paling aman, tanpa expose ke internet)

```bash
ssh -L 5193:127.0.0.1:5193 -L 3021:127.0.0.1:3021 -L 3020:127.0.0.1:3020 user@ip-server-kamu
```

Lalu buka `http://localhost:5193` di browser laptop kamu seperti biasa. Cocok untuk
tim kecil/internal yang semuanya punya akses SSH ke server.

### 6.3 Di server dengan domain publik (dashboard perlu diakses banyak orang lewat internet)

Karena semua service dibatasi ke `127.0.0.1`, kamu **wajib** pasang reverse proxy
(nginx atau Caddy) di depan, plus **HTTPS/TLS** — jangan expose port Docker secara
langsung ke internet.

**Opsi termudah: Caddy** (otomatis HTTPS lewat Let's Encrypt)

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
dashboard.namadomainkamu.com {
    reverse_proxy 127.0.0.1:5193
}

api.namadomainkamu.com {
    reverse_proxy 127.0.0.1:3021
}
```

```bash
sudo systemctl reload caddy
```

**Kalau pakai nginx** contoh minimal untuk dashboard (ulangi mirip untuk backend
di subdomain lain, lalu pasang TLS dengan `certbot`):

```nginx
server {
    listen 80;
    server_name dashboard.namadomainkamu.com;
    location / {
        proxy_pass http://127.0.0.1:5193;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo certbot --nginx -d dashboard.namadomainkamu.com -d api.namadomainkamu.com
```

Setelah reverse proxy jalan, **update**:
- `csc-backend/.env` → `CORS_ORIGIN=https://dashboard.namadomainkamu.com`
- `csc-dashboard/.env` → `VITE_API_BASE_URL=https://api.namadomainkamu.com/api`
- rebuild frontend: `docker compose up -d --build frontend`
- restart backend: `docker compose restart backend`

**Firewall server** (contoh `ufw`) — hanya buka port yang benar-benar perlu dari
internet (80/443 untuk web, 22 untuk SSH). Port 5193/3021/3020/5443 **tidak perlu**
dibuka ke publik karena sudah dibatasi ke `127.0.0.1` dan diakses lewat proxy:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 6.4 Jalan otomatis setelah server reboot

Semua service sudah `restart: unless-stopped`, jadi otomatis nyala lagi setelah
`docker` service jalan. Pastikan Docker sendiri aktif saat boot:

```bash
sudo systemctl enable docker
```

---

## 7. Perintah operasional sehari-hari

```bash
docker compose up -d              # nyalain semua (tanpa rebuild)
docker compose down               # matiin semua (data DB & sesi WA tetap ada)
docker compose down -v            # matiin + HAPUS SEMUA DATA (reset total)
docker compose logs -f backend    # log backend real-time
docker compose logs -f whatsapp   # log GOWA real-time
docker compose restart backend    # restart 1 service saja
docker compose ps                 # status semua service
```

Lihat isi database (tidak ada GUI bawaan seperti phpMyAdmin di versi ini):

```bash
docker exec -it csc-postgres-v31 psql -U csc_user -d csc_dashboard
```

Atau pakai DBeaver/TablePlus, connect ke `127.0.0.1:5443` (kalau dari laptop sendiri)
atau lewat SSH tunnel (kalau dari server, sesuai Bagian 6.2).

---

## 8. Live-reload saat development

- Edit file di `csc-backend/src` atau `csc-dashboard/src` → otomatis ke-reload
  (sudah di-mount sebagai volume), tanpa rebuild.
- Kalau nambah/ubah dependency di `package.json` → wajib rebuild:
  ```bash
  docker compose up -d --build backend
  docker compose up -d --build frontend
  ```

---

## 9. Troubleshooting

| Gejala | Kemungkinan penyebab & solusi |
|---|---|
| Backend gagal start / langsung exit | `BACKEND_API_KEY` kosong di `csc-backend/.env` (sengaja *fail-closed*). Isi nilainya. |
| Frontend tidak bisa fetch data (401/403) | `VITE_API_KEY` ≠ `BACKEND_API_KEY`. Samakan lalu `docker compose up -d --build frontend`. |
| Webhook approve/reject tidak masuk | `WHATSAPP_WEBHOOK_SECRET` beda antara `.env` root dan `csc-backend/.env`. |
| `docker compose logs postgres` error saat start | Volume lama bentrok skema baru — kalau memang boleh reset: `docker compose down -v && docker compose up -d --build`. |
| Tidak bisa kirim WA (masih mode simulasi) | Belum scan QR di GOWA (Bagian 5.1), atau sesi logout. |
| Tidak bisa akses dashboard dari komputer lain di server | Ingat: port dibatasi ke `127.0.0.1` by design — pakai SSH tunnel (6.2) atau reverse proxy+HTTPS (6.3), jangan ubah bind address ke `0.0.0.0` di server publik. |

---

## 10. Checklist keamanan sebelum dipakai serius / dipentest

- [ ] Semua password di `.env.example` sudah diganti nilai acak asli (bukan `ganti_dengan_...`)
- [ ] `BACKEND_API_KEY` sama persis di 3 tempat, panjang & acak (`openssl rand -hex 32`)
- [ ] `WHATSAPP_WEBHOOK_SECRET` sama persis di 2 tempat
- [ ] Kalau diakses publik: sudah pakai reverse proxy + HTTPS (bukan HTTP polos)
- [ ] `CORS_ORIGIN` diisi domain dashboard yang sebenarnya, bukan `*`
- [ ] Firewall server hanya buka 22/80/443 ke internet
- [ ] File `.env` tidak ter-commit ke Git (`.gitignore` sudah menghandle ini)
- [ ] Sadar bahwa `VITE_API_KEY` bukan pengganti login per-user — kalau butuh multi-user dengan hak akses berbeda, perlu upgrade ke autentikasi berbasis login (JWT/session)

---

## 11. Ringkasan cepat (TL;DR)

```bash
unzip csc-stack-v3_1-fix-high-3_1-3_2.zip -d csc-stack && cd csc-stack
cp .env.example .env
cp csc-backend/.env.example csc-backend/.env
cp csc-dashboard/.env.example csc-dashboard/.env
# isi BACKEND_API_KEY, WHATSAPP_WEBHOOK_SECRET, POSTGRES_PASSWORD dengan nilai acak
# samakan BACKEND_API_KEY = VITE_API_KEY di csc-dashboard/.env
docker compose up -d --build
docker compose ps
# buka GOWA, scan QR
# buka dashboard: localhost (laptop) / SSH tunnel / domain+reverse proxy (server)
```
