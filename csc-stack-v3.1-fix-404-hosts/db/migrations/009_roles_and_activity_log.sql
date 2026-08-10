-- Migration v3.11: role-based access (Super Admin / Admin / Pengguna) +
-- audit trail lintas-entitas ("siapa create/update/delete apa").
--
-- HANYA perlu dijalankan manual kalau volume Postgres kamu SUDAH ADA
-- sebelumnya. Cara jalankan:
--   docker exec -i csc-postgres-v31 psql -U csc_user -d csc_dashboard \
--     < db/migrations/009_roles_and_activity_log.sql
--
-- SETELAH itu, admin Super Admin ("itgssuperadmin") HARUS di-seed
-- terpisah (password di-hash bcrypt, TIDAK PERNAH plaintext) -- lihat
-- instruksi seed manual yang menyertai migration ini.

-- Tabel "admins" (dari v3.10) sekarang menampung LEBIH dari sekadar admin
-- -- ada juga role "pengguna" (read-only) -- jadi di-rename supaya nama
-- tabelnya tidak menyesatkan.
ALTER TABLE admins RENAME TO users;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'pengguna'));

-- Audit trail generik -- SATU tabel untuk semua entitas (Template, Kontak,
-- Kirim Pesan, User, dst), supaya "klik nama user di Manage User -> lihat
-- semua yang pernah dia lakukan" bisa query 1 tabel ini saja, tanpa perlu
-- gabungkan banyak tabel riwayat yang beda-beda bentuk.
--
-- actor_type: 'user' (login dashboard, actor_user_id & actor_username
--   keduanya terisi) ATAU 'system' (dipicu integrasi eksternal lewat
--   X-API-Key doang, TANPA sesi login -- mis. POST /send-message dari Web
--   E-Picking -- actor_user_id NULL, actor_username diisi label apa
--   adanya, contoh "system_api_key").
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_username VARCHAR(100),
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user',
  action VARCHAR(30) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(50),
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
