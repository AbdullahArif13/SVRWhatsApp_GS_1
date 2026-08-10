-- Migration v3.3: pisahkan status "Nonaktif" (is_active) dari "Dihapus /
-- masuk panel Database" (is_deleted) -- sebelumnya dua-duanya cuma satu
-- kolom (is_active), jadi tidak bisa nonaktifkan template tanpa otomatis
-- ke-pindah ke panel Database.
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya (jadi db/schema.sql tidak otomatis jalan lagi). Kalau kamu
-- mulai dari volume baru/kosong (docker compose down -v && docker compose
-- up -d), file ini tidak perlu dijalankan -- isinya sudah masuk ke
-- db/schema.sql.
--
-- Cara jalankan (ganti csc_user/csc_dashboard kalau nama user/db kamu beda):
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/003_soft_delete_status.sql

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
