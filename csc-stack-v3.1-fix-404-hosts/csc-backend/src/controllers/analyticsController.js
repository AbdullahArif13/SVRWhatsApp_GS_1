import {
  isValidGranularity,
  getMessageTrend,
  getStatusBreakdown,
  getTemplateUsage,
  getContactGrowth,
  getReplyRatio,
} from "../data/analytics.js";


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