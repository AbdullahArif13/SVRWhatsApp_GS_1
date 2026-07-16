-- Migration fitur "Approve / Reject". HANYA perlu dijalankan manual kalau
-- volume Postgres kamu SUDAH ADA sebelumnya (jadi db/schema.sql tidak
-- otomatis jalan lagi). Kalau kamu mulai dari volume baru/kosong
-- (docker compose down -v && docker compose up -d), file ini tidak perlu
-- dijalankan -- isinya sudah masuk ke db/schema.sql.
--
-- Cara jalankan:
--   docker exec -i csc-postgres-v3 psql -U $POSTGRES_USER -d $POSTGRES_DB \
--     < db/migrations/002_approve_reject.sql

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS require_reply BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS message_logs (
  id SERIAL PRIMARY KEY,
  template_wa VARCHAR(255) NOT NULL,
  no_wa VARCHAR(20) NOT NULL,
  nama_wa VARCHAR(255),
  recipient_name VARCHAR(255),
  values_json JSONB NOT NULL DEFAULT '{}',
  final_message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  provider_message_id VARCHAR(255),
  require_reply BOOLEAN NOT NULL DEFAULT false,
  reply_status VARCHAR(20) NOT NULL DEFAULT 'tidak_diperlukan',
  reply_raw_text TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_provider_message_id
  ON message_logs (provider_message_id);

CREATE TABLE IF NOT EXISTS received_messages (
  id SERIAL PRIMARY KEY,
  wa_message_id VARCHAR(255),
  chat_id VARCHAR(50),
  from_wa VARCHAR(50),
  from_name VARCHAR(255),
  body TEXT,
  replied_to_id VARCHAR(255),
  matched_message_log_id INTEGER REFERENCES message_logs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_received_messages_replied_to_id
  ON received_messages (replied_to_id);
