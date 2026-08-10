-- Migration: dukung kirim pesan ke GRUP WhatsApp.
--
-- message_logs.no_wa sebelumnya VARCHAR(20) -- cukup untuk nomor HP biasa,
-- tapi JID grup ("<id>@g.us", atau format lama "<nomor>-<timestamp>@g.us")
-- bisa lebih dari 20 karakter, jadi INSERT-nya ditolak PostgreSQL
-- ("value too long for type character varying(20)") begitu backend coba
-- kirim ke grup. Diperlebar jadi VARCHAR(50) supaya cukup untuk kedua
-- format JID grup di atas.
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya (jadi db/schema.sql tidak otomatis jalan lagi). Kalau kamu
-- mulai dari volume baru/kosong (docker compose down -v && docker compose
-- up -d), file ini tidak perlu dijalankan -- isinya sudah masuk ke
-- db/schema.sql.
--
-- Cara jalankan (ganti csc_user/csc_dashboard kalau nama user/db kamu beda):
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/007_group_jid_length.sql

ALTER TABLE message_logs
  ALTER COLUMN no_wa TYPE VARCHAR(50);
