-- Billing (Stripe, test mode first): trial dates, the Stripe customer link and a protected card fingerprint on User,
-- plus Subscription and BillingEvent. Additive only: four new optional columns (empty for every existing account)
-- and two new tables. No existing data changes; the credits table is not touched.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "trialStartedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "trialEndsAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "trialCardFingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
-- Not unique on purpose: a matching card flags the trial for review, it never blocks it automatically.
CREATE INDEX "User_trialCardFingerprint_idx" ON "User"("trialCardFingerprint");

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'plus',
    "priceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
-- At most one open subscription per person, enforced by the database (no duplicate subscriptions or charges).
CREATE UNIQUE INDEX "Subscription_one_open_per_user" ON "Subscription"("userId")
    WHERE "status" IN ('incomplete', 'active', 'past_due', 'unpaid');

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "BillingEvent_type_receivedAt_idx" ON "BillingEvent"("type", "receivedAt");
