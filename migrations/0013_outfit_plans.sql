-- Planner: one row per person per month with that month's planned outfits (the days are JSON: each date's closet
-- piece ids, and whether it was generated or edited by hand). Additive only: one new table, deleted along with its
-- account. No existing data changes.

-- CreateTable
CREATE TABLE "OutfitPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "days" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutfitPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OutfitPlan_userId_month_key" ON "OutfitPlan"("userId", "month");
