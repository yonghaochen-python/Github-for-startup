-- AI Stylist analyses: one row per report (color, makeup, hair or style), with its JSON results, the portrait it
-- used, and token counts / estimated cost for the owner's cost tracking. Additive only: one new table, deleted along
-- with its account. No existing data changes.

-- CreateTable
CREATE TABLE "StudioReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" TEXT,
    "portraitVersion" TEXT,
    "requestId" TEXT NOT NULL,
    "practice" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costMicros" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "StudioReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioReport_userId_requestId_key" ON "StudioReport"("userId", "requestId");

-- CreateIndex
CREATE INDEX "StudioReport_userId_module_createdAt_idx" ON "StudioReport"("userId", "module", "createdAt");
