-- Social feed, stage 3: likes, private dislikes, and saves. Additive only: two new tables; no existing data changes.

-- One reaction per person per post: like (counted on the post, shown) or dislike (private: never counted or shown,
-- only used to show that person fewer posts like it).
CREATE TABLE "PostReaction" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    -- like | dislike
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PostReaction_postId_kind_idx" ON "PostReaction"("postId", "kind");

-- A post someone saved to Saved → Inspiration (private to them).
CREATE TABLE "PostSave" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "PostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PostSave_userId_createdAt_idx" ON "PostSave"("userId", "createdAt");
