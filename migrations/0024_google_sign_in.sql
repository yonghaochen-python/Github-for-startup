-- Sign in with Google: Google's own id for the person ("sub"), so the same Google account opens the same Virm account
-- next time. Additive only: one new optional column on User (empty for every existing account) and its unique index.
-- No existing data changes. Virm never gets the person's Google password; only their email, name and this id.
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
