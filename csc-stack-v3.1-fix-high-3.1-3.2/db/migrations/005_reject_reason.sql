ALTER TABLE message_logs
    ADD COLUMN IF NOT EXISTS reply_reason TEXT;