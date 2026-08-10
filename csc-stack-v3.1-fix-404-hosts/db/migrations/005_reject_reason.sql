-- Migration v3.5: alasan Reject (opsional).
--
-- Sebelumnya Reject cuma dicatat statusnya doang ('reject') + raw text
-- balasannya (reply_raw_text) apa adanya. Sekarang kalau user membalas
-- dengan format "Reject, karena <alasan>" (mis. "Reject, karena
-- maskernya ada yang rusak"), bagian alasannya di-parse otomatis dan
-- disimpan terpisah di kolom ini -- supaya gampang ditampilkan di popup
-- MessageHistory tanpa perlu parsing ulang reply_raw_text di frontend.
-- Reject TANPA alasan (cuma "Reject"/"N") tetap valid, reply_reason-nya
-- NULL.
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya (jadi db/schema.sql tidak otomatis jalan lagi). Kalau kamu
-- mulai dari volume baru/kosong (docker compose down -v && docker compose
-- up -d), file ini tidak perlu dijalankan -- isinya sudah masuk ke
-- db/schema.sql.
--
-- Cara jalankan (ganti csc_user/csc_dashboard kalau nama user/db kamu beda):
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/005_reject_reason.sql

ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS reply_reason TEXT;
