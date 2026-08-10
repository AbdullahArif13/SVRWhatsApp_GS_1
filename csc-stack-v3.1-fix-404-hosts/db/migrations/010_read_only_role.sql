-- Migration v3.12: perbaikan role model -- ternyata 'pengguna' BUKAN
-- read-only (dia operator biasa: bisa Tambah Kontak, Tambah Template,
-- Chat, Riwayat Pengiriman -- makanya aktivitasnya perlu dipantau lewat
-- Manage User). Role read-only yang SEBENARNYA (cuma boleh lihat
-- Dashboard analitik) jadi role BARU terpisah: 'read_only'.
--
-- Jadi sekarang total 4 role: super_admin, admin, pengguna, read_only.
--
-- Cara jalankan:
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/010_read_only_role.sql

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'pengguna', 'read_only'));
