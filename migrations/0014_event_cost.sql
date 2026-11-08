-- AI cost per event: the real cost of a Claude call (adding clothes, Style it, outfit explanations), in millionths
-- of a dollar, worked out from the token counts Claude returns. Empty for every other event. Additive only: one new
-- optional column; no existing data changes.

-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN "costMicros" INTEGER;
