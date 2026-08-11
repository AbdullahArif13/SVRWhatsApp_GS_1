import {
  isValidGranularity,
  getMessageTrend,
  getStatusBreakdown,
  getTemplateUsage,
  getContactGrowth,
  getReplyRatio,
} from "../data/analytics.js";

/**
 * GET /api/analytics/overview?granularity=daily|monthly|yearly&day=YYYY-MM-DD&month=1-12&year=YYYY
 *
 * Dashboard analitik interaktif (v3.13) -- SATU endpoint mengembalikan
 * semua dataset grafik sekaligus, supaya FrontEnd cukup 1x fetch pas buka
 * halaman Dashboard. SEMUA dataset di bawah ikut menyesuaikan skop waktu
 * yang sama (granularity + day/month/year yang dipilih user) -- jadi bukan
 * cuma grafik tren yang berubah, tapi seluruh dashboard:
 *   - messageTrend    : tren jumlah pesan terkirim/gagal per 30
 *                       menit(daily)/hari(monthly)/bulan(yearly)
 *   - statusBreakdown : total pengiriman per status (terkirim/gagal/antri)
 *                       DI PERIODE yang dipilih
 *   - templateUsage   : jumlah pemakaian per template DI PERIODE yang dipilih
 *   - contactGrowth   : pertumbuhan jumlah kontak baru, skop sama seperti
 *                       messageTrend di atas
 *   - replyRatio      : rasio balasan Approve/Reject/Menunggu/Tidak
 *                       Diperlukan DI PERIODE yang dipilih
 *
 * - `day`   dipakai kalau granularity = "daily" (default hari ini; HANYA
 *           boleh tanggal di bulan & tahun berjalan -- lihat range() di
 *           data/analytics.js untuk detail pengamanannya)
 * - `month` dipakai kalau granularity = "monthly" (default bulan berjalan)
 * - `year`  dipakai kalau granularity = "yearly" (default tahun berjalan)
 * Parameter yang gak relevan sama granularity yang dipilih diabaikan.
 *
 * SENGAJA TIDAK dibatasi requireRole (lihat routes/analyticsRoutes.js) --
 * bisa diakses SEMUA role yang login (termasuk 'pengguna'/read-only) DAN
 * integrasi eksternal yang cuma punya X-API-Key (tanpa sesi login sama
 * sekali), supaya data yang sama bisa dipakai bikin tampilan lain di luar
 * dashboard ini.
 */
export async function handleGetOverview(req, res) {
  const granularity = isValidGranularity(req.query.granularity) ? req.query.granularity : "daily";

  const dayParam = typeof req.query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day) ? req.query.day : undefined;
  const monthParam = Number.parseInt(req.query.month, 10);
  const yearParam = Number.parseInt(req.query.year, 10);
  const options = {
    day: dayParam,
    month: Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined,
    year: Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : undefined,
  };

  const [messageTrend, statusBreakdown, templateUsage, contactGrowth, replyRatio] = await Promise.all([
    getMessageTrend(granularity, options),
    getStatusBreakdown(granularity, options),
    getTemplateUsage(granularity, options),
    getContactGrowth(granularity, options),
    getReplyRatio(granularity, options),
  ]);

  return res.status(200).json({
    success: true,
    granularity,
    data: { messageTrend, statusBreakdown, templateUsage, contactGrowth, replyRatio },
  });
}