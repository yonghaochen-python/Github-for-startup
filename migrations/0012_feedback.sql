-- Good / Bad feedback on try-ons, live sessions, "Style it" outfits and AI Stylist reports. The first Bad in a monthly
-- period gives a one-time thank-you of extra credits (recorded as a normal credit adjustment); rewardPeriod's unique
-- index makes sure that happens at most once per person per period. Additive only: one new table, deleted along
-- with its account. No existing data changes.

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "rewardPeriod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_userId_kind_targetId_key" ON "Feedback"("userId", "kind", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_userId_rewardPeriod_key" ON "Feedback"("userId", "rewardPeriod");

-- CreateIndex
CREATE INDEX "Feedback_kind_rating_createdAt_idx" ON "Feedback"("kind", "rating", "createdAt");
