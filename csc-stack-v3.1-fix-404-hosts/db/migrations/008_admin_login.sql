-- Migration v3.10: login dashboard (username + password), Admin-only
-- untuk saat ini -- Admin yang login bisa akses semua fitur dashboard
-- (sama seperti sebelum ada login, tidak ada pembatasan tambahan).
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya (jadi db/schema.sql tidak otomatis jalan lagi). Kalau kamu
-- mulai dari volume baru/kosong (docker compose down -v && docker compose
-- up -d), file ini tidak perlu dijalankan -- isinya sudah masuk ke
-- db/schema.sql.
--
-- Cara jalankan (ganti csc_user/csc_dashboard kalau nama user/db kamu beda):
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/008_admin_login.sql
--
-- SETELAH itu, admin awal (username "itgsadmin") HARUS di-seed terpisah
-- lewat script Node (supaya password di-hash bcrypt, TIDAK PERNAH
-- disimpan plaintext) -- lihat instruksi di PR/README terkait, atau minta
-- dibuatkan ulang.

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skema baku "connect-pg-simple" (session store express-session) -- JANGAN
-- diubah nama kolom/tabelnya, library ini query langsung ke nama persis ini.
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
