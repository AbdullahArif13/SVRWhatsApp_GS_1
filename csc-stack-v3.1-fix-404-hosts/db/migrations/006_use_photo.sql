-- Migration v3.7: parameter True/False "Penggunaan Foto" per template.
--
-- Sama pola-nya dengan require_reply (migration lama): ini flag baru DI
-- LEVEL TEMPLATE (bukan per pengiriman) supaya toggle "Aktifkan Penggunaan
-- Foto" di halaman Create Template / popup detail template bisa disimpan.
--
--   true  -> template ini MEWAJIBKAN `values.foto` (URL gambar) diisi tiap
--            kali dipakai lewat POST /api/send-message -- kalau tidak
--            diisi, request ditolak (400), mirip validasi {{variabel}}
--            yang belum diisi. Kalau diisi, foto dikirim sebagai pesan
--            WA terpisah setelah teks template (lihat queueService.js).
--   false -> (default, perilaku lama) `values.foto`/`values.keterangan`
--            di payload -- SEKALIPUN dikirim -- SENGAJA DIABAIKAN, tidak
--            ada foto yang dikirim. Supaya toggle ini benar-benar
--            menentukan bisa/tidaknya foto terkirim untuk template
--            tersebut, bukan cuma dokumentasi doang.
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya (jadi db/schema.sql tidak otomatis jalan lagi). Kalau kamu
-- mulai dari volume baru/kosong (docker compose down -v && docker compose
-- up -d), file ini tidak perlu dijalankan -- isinya sudah masuk ke
-- db/schema.sql.
--
-- Cara jalankan (ganti csc_user/csc_dashboard kalau nama user/db kamu beda):
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/006_use_photo.sql

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS use_photo BOOLEAN NOT NULL DEFAULT false;
