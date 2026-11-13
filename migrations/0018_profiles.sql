-- Public profiles (social feed, stage 1): an @username, a short bio and a profile picture.
-- Additive only: three new optional columns on User (empty for every existing account) and one index.
-- No existing data changes. The email is never shown publicly; only the username, display name, bio and picture are.

-- The public handle, stored in lowercase (e.g. "laura.w"). Unique; empty until the person picks one.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
-- A short public bio (up to 150 characters). Empty = none.
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
-- Where the public profile picture is stored (a small square copy under profiles/, never the private try-on photo).
ALTER TABLE "User" ADD COLUMN "avatarKey" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
