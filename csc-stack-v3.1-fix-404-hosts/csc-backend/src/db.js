import pg from "pg";

const { Pool } = pg;

/**
 * Connection pool ke PostgreSQL yang jalan di Docker (lihat
 * docker-compose.yml di root project ini). Semua kredensial datang dari
 * .env supaya gampang beda-beda antara laptop kamu.
 */
export const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "csc_user",
  password: process.env.DB_PASSWORD || "csc_password",
  database: process.env.DB_NAME || "csc_dashboard",
  max: 10,
});
