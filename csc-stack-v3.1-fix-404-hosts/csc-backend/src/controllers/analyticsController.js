import {
  isValidGranularity,
  getMessageTrend,
  getStatusBreakdown,
  getTemplateUsage,
  getContactGrowth,
  getReplyRatio,
} from "../data/analytics.js";

/**
 * GET /api/analytics/overview?granularity=daily|monthly|yearly
 *
 * Dashboard analitik interaktif (v3.11) -- SATU endpoint mengembalikan
 * semua dataset grafik sekaligus, supaya FrontEnd cukup 1x fetch pas buka
 * halaman Dashboard:
 *   - messageTrend    : tren jumlah pesan terkirim/gagal per hari/bulan/tahun
 *   - statusBreakdown : total pengiriman per status (terkirim/gagal/antri)
 *   - templateUsage   : jumlah pemakaian per template
 *   - contactGrowth   : pertumbuhan jumlah kontak baru per hari/bulan/tahun
 *   - replyRatio      : rasio balasan Approve/Reject/Menunggu/Tidak Diperlukan
 *
 * SENGAJA TIDAK dibatasi requireRole (lihat routes/analyticsRoutes.js) --
 * bisa diakses SEMUA role yang login (termasuk 'pengguna'/read-only) DAN
 * integrasi eksternal yang cuma punya X-API-Key (tanpa sesi login sama
 * sekali), supaya data yang sama bisa dipakai bikin tampilan lain di luar
 * dashboard ini.
 */
export async function handleGetOverview(req, res) {
  const granularity = isValidGranularity(req.query.granularity) ? req.query.granularity : "daily";

  const [messageTrend, statusBreakdown, templateUsage, contactGrowth, replyRatio] = await Promise.all([
    getMessageTrend(granularity),
    getStatusBreakdown(),
    getTemplateUsage(),
    getContactGrowth(granularity),
    getReplyRatio(),
  ]);

  return res.status(200).json({
    success: true,
    granularity,
    data: { messageTrend, statusBreakdown, templateUsage, contactGrowth, replyRatio },
  });
}
