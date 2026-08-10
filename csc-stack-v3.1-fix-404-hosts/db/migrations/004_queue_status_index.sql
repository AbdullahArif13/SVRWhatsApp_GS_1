-- Migration v3.4: antrian pengiriman (lihat csc-backend/src/services/queueService.js).
--
-- Pesan yang masuk lewat POST /api/send-message sekarang disimpan dulu ke
-- message_logs dengan status = 'antri' SEBELUM beneran dikirim ke GOWA.
-- Index ini bikin query "ambil semua baris yang masih 'antri'" (dipanggil
-- queueService.initQueueFromDatabase() tiap backend restart) tetap cepat
-- walau tabel message_logs sudah besar.
--
-- Tidak perlu ALTER kolom apa pun -- kolom `status` di message_logs
-- sudah VARCHAR(20) bebas isi apa saja sejak awal, jadi nilai baru
-- 'antri' otomatis bisa dipakai tanpa migrasi struktur kolom.
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya (jadi db/schema.sql tidak otomatis jalan lagi). Kalau kamu
-- mulai dari volume baru/kosong (docker compose down -v && docker compose
-- up -d), file ini tidak perlu dijalankan -- isinya sudah masuk ke
-- db/schema.sql.
--
-- Cara jalankan (ganti csc_user/csc_dashboard kalau nama user/db kamu beda):
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/004_queue_status_index.sql

CREATE INDEX IF NOT EXISTS idx_message_logs_status
  ON message_logs (status);
