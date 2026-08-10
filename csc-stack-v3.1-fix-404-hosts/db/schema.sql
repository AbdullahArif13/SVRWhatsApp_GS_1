-- Dijalankan OTOMATIS oleh container Postgres sekali saja, pas volume-nya
-- masih kosong (pertama kali `docker compose up`).
-- Kalau mau reset total (hapus semua data & bikin ulang dari file ini):
--   docker compose down -v && docker compose up -d

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  body TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Approve',
  -- v3.3: sekarang ada DUA flag terpisah, bukan cuma satu lagi --
  --   is_active  -> toggle Aktif/Nonaktif biasa di tabel utama. Klik
  --                 toggle-nya langsung ganti nilai ini, template TETAP
  --                 tampil di tabel utama baik Aktif maupun Nonaktif.
  --   is_deleted -> "Hapus" (icon tong sampah). Template PINDAH dari
  --                 tabel utama ke panel "Database" -- baris-nya TIDAK
  --                 hilang dari database, cuma disembunyikan dari tabel
  --                 utama sampai di-restore lagi lewat panel Database.
  -- Baris betul-betul dihapus (DELETE FROM ...) hanya lewat endpoint
  -- DELETE /api/templates/:id (lihat handleDeleteTemplate di
  -- messageController.js) -- TIDAK dipakai/dipicu dari UI manapun saat ini.
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- v3.2: parameter True/False di halaman "Create Template".
  --   true  -> penerima WAJIB membalas pesan ini dengan mengetik
  --            "Approve" atau "Reject" (dicek di webhookController.js
  --            begitu balasannya masuk dari GOWA).
  --   false -> penerima TIDAK harus membalas apa-apa (perilaku lama,
  --            default).
  require_reply BOOLEAN NOT NULL DEFAULT false,
  -- v3.7: parameter True/False "Aktifkan Penggunaan Foto" di halaman
  -- Create Template (lihat migration 006_use_photo.sql untuk detail).
  --   true  -> `values.foto` (URL gambar) WAJIB diisi tiap kali template
  --            ini dipakai lewat POST /api/send-message -- kalau diisi,
  --            dikirim sebagai pesan foto terpisah setelah teks (lihat
  --            queueService.js), caption-nya dari `values.keterangan`.
  --   false -> (default) `values.foto`/`values.keterangan` diabaikan
  --            walau dikirim -- tidak ada foto yang terkirim.
  use_photo BOOLEAN NOT NULL DEFAULT false
);


-- v3: tabel kontak. Diisi lewat 2 jalur:
--   1. OTOMATIS, tiap ada request masuk ke POST /api/send-message (field
--      no_wa + nama_wa di body-nya) -- lihat upsertContactFromMessage di
--      csc-backend/src/data/contacts.js.
--   2. MANUAL, lewat form "Add Contact" di dashboard (POST /api/contacts).
-- no_wa disimpan dalam bentuk digit ternormalisasi (awalan "0" -> "62")
-- supaya "089..." dari satu sumber dan "6289..." dari sumber lain dianggap
-- kontak yang sama, tidak dobel.
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  no_wa VARCHAR(20) NOT NULL UNIQUE,
  nama_wa VARCHAR(255) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' | 'send_message'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Postgres tidak punya "ON UPDATE CURRENT_TIMESTAMP" bawaan seperti MySQL,
-- jadi updated_at di-refresh pakai trigger kecil ini tiap kali baris di
-- tabel contacts di-UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- v3.2: riwayat pengiriman pindah dari in-memory (src/data/messageLogs.js)
-- ke tabel ini, supaya:
--   1. Tidak hilang tiap restart backend (sama seperti templates & contacts).
--   2. Bisa dicocokkan dengan balasan user yang masuk lewat webhook GOWA
--      (kolom provider_message_id <-> payload.replied_to_id dari webhook),
--      untuk fitur Approve/Reject.
CREATE TABLE IF NOT EXISTS message_logs (
  id SERIAL PRIMARY KEY,
  template_wa VARCHAR(255) NOT NULL,
  -- VARCHAR(50), BUKAN 20 -- harus cukup buat JID grup ("<id>@g.us", atau
  -- format lama "<nomor>-<timestamp>@g.us"), bukan cuma nomor HP biasa.
  no_wa VARCHAR(50) NOT NULL,
  nama_wa VARCHAR(255),
  recipient_name VARCHAR(255),
  values_json JSONB NOT NULL DEFAULT '{}',
  final_message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'terkirim' | 'gagal'
  error_message TEXT,
  -- ID pesan dari provider (GOWA, field results.message_id pas kirim
  -- berhasil). Ini kunci yang dipakai buat mencocokkan balasan user
  -- (payload.replied_to_id di webhook "message") ke baris kiriman ini.
  provider_message_id VARCHAR(255),
  -- Disalin dari templates.require_reply PADA SAAT pesan ini dikirim, jadi
  -- kalau template-nya diubah belakangan, riwayat lama tidak ikut berubah.
  require_reply BOOLEAN NOT NULL DEFAULT false,
  -- 'tidak_diperlukan' (require_reply=false) | 'menunggu' | 'approve' | 'reject'
  reply_status VARCHAR(20) NOT NULL DEFAULT 'tidak_diperlukan',
  reply_raw_text TEXT,
  -- v3.5: alasan Reject (opsional) yang di-parse dari reply_raw_text,
  -- mis. "Reject, karena maskernya ada yang rusak" -> reply_reason =
  -- "maskernya ada yang rusak". null kalau Reject tanpa alasan, atau
  -- kalau reply_status bukan 'reject'.
  reply_reason TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_provider_message_id
  ON message_logs (provider_message_id);

-- v3.4: antrian pengiriman (lihat services/queueService.js) query baris
-- 'antri' tiap kali backend restart buat nyusun ulang antrian di memori
-- -- index ini biar query itu tetap cepat walau message_logs sudah gede.
CREATE INDEX IF NOT EXISTS idx_message_logs_status
  ON message_logs (status);

-- v3.2: SETIAP pesan masuk (balasan user apa pun, bukan cuma yang cocok
-- dengan kiriman template) dicatat di sini dulu -- log mentah/audit trail
-- lengkap dari webhook GOWA, terlepas dari apakah berhasil dicocokkan ke
-- message_logs atau tidak.
CREATE TABLE IF NOT EXISTS received_messages (
  id SERIAL PRIMARY KEY,
  wa_message_id VARCHAR(255),
  chat_id VARCHAR(50),
  from_wa VARCHAR(50),
  from_name VARCHAR(255),
  body TEXT,
  replied_to_id VARCHAR(255), -- payload.replied_to_id dari webhook (kalau ini balasan)
  matched_message_log_id INTEGER REFERENCES message_logs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_received_messages_replied_to_id
  ON received_messages (replied_to_id);

-- Data contoh, biar begitu backend dinyalakan langsung ada isinya
-- (sama seperti 2 template contoh yang tadinya hardcode di templates.js).
-- 'spct_order' dicontohkan pakai require_reply = true, karena isinya
-- memang minta approval ("Silakan melakukan pengecekan atas request
-- tersebut") -- jadi begitu backend baru dinyalakan, langsung ada contoh
-- nyata cara pakai fitur Approve/Reject.
INSERT INTO templates (name, body, status, is_active, require_reply) VALUES
  (
    'spct_order',
    -- CATATAN: kalimat "...ketik Approve atau Reject" SENGAJA tidak lagi
    -- ditulis manual di sini -- sejak REQUIRE_REPLY_INSTRUCTION
    -- (csc-backend/src/utils/templateEngine.js) ditambahkan, kalimat itu
    -- otomatis ditempel di akhir pesan oleh backend karena require_reply
    -- template ini = true di bawah. Ini berlaku untuk template MANA PUN
    -- yang require_reply-nya true, tidak cuma 'spct_order'.
    E'Halo Bapak/Ibu {{nama}},\n\nKami informasikan terdapat Request Part pada Web E-Picking SPCT dengan rincian berikut:\n\nNomor Request : {{nomor_request}}\nRequester : {{requester}}\n\nDetail Item Request:\n{{item}}\n\nSilakan melakukan pengecekan atas request tersebut sesuai kebutuhan.\n\nTerima kasih atas perhatian Anda.',
    'Approve',
    true,
    true
  ),
  (
    'Reminder_Switch_Alert',
    E'Selamat pagi {{nama}}, mohon konfirmasi status switch {{lokasi}} sebelum pukul {{jam}}.',
    'Approve',
    true,
    false
  )
ON CONFLICT (name) DO NOTHING;

-- v3.12: login dashboard (username + password) + role-based access --
-- 'super_admin' (otorisasi penuh, termasuk paksa-logout sesi lain),
-- 'admin' (semua fitur SAMA kecuali TIDAK bisa paksa-logout, tapi bisa
-- bikin akun role 'pengguna'/'read_only'), 'pengguna' (operator biasa --
-- bisa Tambah Kontak, Tambah Template, Chat, Riwayat Pengiriman, TAPI
-- tidak bisa Manage User/Sesi Login -- aktivitasnya dipantau Admin lewat
-- Manage User), 'read_only' (BENERAN read-only, cuma bisa lihat Dashboard
-- analitik). password_hash pakai bcrypt (LIHAT: kolom ini TIDAK PERNAH
-- diisi plaintext, lihat seed manual di
-- db/migrations/009_roles_and_activity_log.sql).
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'pengguna', 'read_only')),
  -- Siapa yang bikin akun ini lewat Manage User (NULL untuk akun awal
  -- yang di-seed manual, bukan lewat endpoint POST /api/users).
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skema baku "connect-pg-simple" (session store express-session) --
-- JANGAN diubah nama kolom/tabelnya, library ini query langsung ke nama
-- persis ini. Dipakai untuk fitur "Sesi Login" di sidebar (Admin bisa
-- lihat siapa saja yang sedang login) -- backend baca tabel ini langsung
-- (kolom `sess` JSON berisi username + waktu login yang kita simpan
-- sendiri di req.session, lihat authController.js).
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

-- v3.11: audit trail generik lintas-entitas (Template, Kontak, Kirim
-- Pesan, User, dst) -- dipakai fitur "klik nama user di Manage User ->
-- lihat semua yang pernah dia lakukan". Lihat penjelasan lengkap kolom
-- actor_type di db/migrations/009_roles_and_activity_log.sql.
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