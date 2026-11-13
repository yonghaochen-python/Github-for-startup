-- Social feed, stage 2: outfit posts, their item details, and reports. Additive only: one new optional column on
-- User (off for everyone) and three new tables. No existing data changes; nothing is public until someone posts.

-- Who may post while posting is limited to testers (admins always can). Off (0) for every existing account.
ALTER TABLE "User" ADD COLUMN "canPost" BOOLEAN NOT NULL DEFAULT false;

-- One public outfit post. The picture is its own public copy (posts/<id>.webp), never a closet or private photo.
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "caption" TEXT,
    -- JSON arrays of short tags, e.g. ["old money","minimalist"] and ["work"].
    "styleTags" TEXT NOT NULL DEFAULT '[]',
    "occasionTags" TEXT NOT NULL DEFAULT '[]',
    -- published | hidden (several reports: waiting for review) | removed (by the owner or an admin)
    "status" TEXT NOT NULL DEFAULT 'published',
    -- Kept on the post so the feed never has to count (likes and saves arrive in stage 3).
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Post_status_createdAt_idx" ON "Post"("status", "createdAt");
CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");

-- The pieces in a post, as the person typed them (every field but the name is optional). closetItemId privately
-- remembers which closet piece it came from (never shown publicly; set to empty if that piece is deleted).
CREATE TABLE "PostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "store" TEXT,
    "link" TEXT,
    -- As the store shows it, e.g. "$49" (store pieces added by link).
    "price" TEXT,
    "imageKey" TEXT,
    "closetItemId" TEXT,
    CONSTRAINT "PostItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostItem_closetItemId_fkey" FOREIGN KEY ("closetItemId") REFERENCES "ClothingItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "PostItem_postId_idx" ON "PostItem"("postId");

-- One person's report of a post (once per person per post). Reviewed in the admin dashboard.
CREATE TABLE "PostReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    -- nudity | harassment | hate | spam | not_mine (someone else's photo) | other
    "reason" TEXT NOT NULL,
    "note" TEXT,
    -- open | dismissed | actioned
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostReport_postId_reporterId_key" ON "PostReport"("postId", "reporterId");
CREATE INDEX "PostReport_status_createdAt_idx" ON "PostReport"("status", "createdAt");
