-- Optional display name shown in the app. Additive only: no existing table is rebuilt.

-- AddColumn
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
