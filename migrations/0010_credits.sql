-- Credit system (count-only to start): each person's plan and monthly period, and a credit history table.
-- Additive only: two new User columns with safe defaults (everyone starts on Free, period from sign-up) and one new
-- table. No existing data is changed or removed.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN "periodAnchor" DATETIME;

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT,
    "note" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_userId_requestId_key" ON "CreditEntry"("userId", "requestId");

-- CreateIndex
CREATE INDEX "CreditEntry_userId_kind_createdAt_idx" ON "CreditEntry"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "CreditEntry_status_createdAt_idx" ON "CreditEntry"("status", "createdAt");
