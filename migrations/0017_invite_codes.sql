-- Invite codes: a friend's code gives a new account the 14-day Plus trial instead of the 7-day one.
-- Additive only: two new optional columns on User (empty for every existing account) and two indexes.
-- No existing data changes. Codes are made the first time someone opens their invite (no backfill needed).

-- Each account's own code to share (e.g. VIRM-K7Q2). Unique; empty until first shown.
ALTER TABLE "User" ADD COLUMN "inviteCode" TEXT;
-- Whose code this account joined with (that account's id). Set once, never changed; empty if no code was used.
ALTER TABLE "User" ADD COLUMN "invitedById" TEXT;

CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");
CREATE INDEX "User_invitedById_idx" ON "User"("invitedById");
