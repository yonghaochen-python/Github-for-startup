-- The Stylist: one style profile per person (the AI's written reading of a photo they chose, their corrections, and
-- the latest styled look). Additive only: one new table, deleted along with its account. No existing data changes.

-- CreateTable
CREATE TABLE "StyleProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "reading" TEXT NOT NULL,
    "corrections" TEXT NOT NULL DEFAULT '{}',
    "look" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StyleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
