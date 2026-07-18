-- Track disclosure-link clicks per representative (funnel metrics: clicks -> leads -> paying clients).
ALTER TABLE "Representative" ADD COLUMN "linkClicks" INTEGER NOT NULL DEFAULT 0;
