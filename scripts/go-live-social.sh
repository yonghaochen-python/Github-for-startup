#!/bin/bash
# Go live with Discover (the social outfit feed): public profiles (0018), posts + reports (0019), likes + saves (0020),
# the Discover tab, posting open to everyone, and "Build an outfit".
# All three database changes only ADD things; nothing existing changes. Safe to run again: anything already added is
# skipped. It stops at the first problem, and nothing is pushed unless every step succeeds. No keys needed.
set -u
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$HOME/bin:$PATH"
DB=a80603c0-a14f-469c-ac32-05506a25371e
BACKUP="$HOME/Documents/virm-backups/$(date +%Y-%m-%d)-social-go-live"
stop() { echo "✗ Stopped: $1"; echo "  Nothing was pushed."; exit 1; }

# The code to publish.
[ "$(git rev-parse --abbrev-ref HEAD)" = "closet-shelf" ] || stop "switch to the closet-shelf branch first."
git fetch -q origin main || stop "couldn't reach GitHub."
git merge-base --is-ancestor origin/main HEAD || stop "the live site has changes this branch doesn't. Ask Claude to merge them in first."
[ -z "$(git status --porcelain -- src migrations prisma cloudflare.config.ts package.json package-lock.json)" ] ||
  stop "there are unsaved code changes. Ask Claude to commit them first."

q() { # a query, retried through Cloudflare's short hiccups; prints the result
  for i in 1 2 3 4 5; do
    if npx cf d1 query "$DB" --sql "${1}" 2>/tmp/virm-golive.err; then return 0; fi
    echo "   (Cloudflare said: $(grep -m1 '\[' /tmp/virm-golive.err) — trying again…)" >&2; sleep 5
  done
  echo "   Failed:" >&2; head -3 /tmp/virm-golive.err >&2; return 1
}
has_column() { q "SELECT name FROM pragma_table_info('$1') WHERE name = '$2';" 2>/dev/null | grep -q "\"$2\""; }
has_object() { q "SELECT name FROM sqlite_master WHERE name = '$1';" 2>/dev/null | grep -q "\"$1\""; }
recorded() { q "SELECT name FROM d1_migrations WHERE name = '$1';" 2>/dev/null | grep -q "\"$1\""; }
record() { recorded "$1" || q "INSERT INTO d1_migrations (name) VALUES ('$1');" >/dev/null; }

echo "→ Backing up the live database to $BACKUP …"
mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
for t in User ClothingItem Outfit OutfitItem OutfitPlan CreditEntry StudioReport Feedback AnalyticsEvent Pick PickVote Subscription d1_migrations; do
  q "SELECT * FROM \"$t\";" > "$BACKUP/$t.json" || stop "couldn't back up $t. Nothing was changed."
  [ -s "$BACKUP/$t.json" ] || stop "the $t backup is empty. Nothing was changed."
done
chmod 600 "$BACKUP"/*.json
echo "✓ Backed up"

echo "→ 0018: public profiles…"
for c in username bio avatarKey; do
  has_column User "$c" || q "ALTER TABLE \"User\" ADD COLUMN \"$c\" TEXT;" >/dev/null || stop "couldn't add User.$c."
done
q 'CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");' >/dev/null || stop "couldn't add the username index."
record 0018_profiles.sql || stop "couldn't record 0018."
echo "✓ 0018 done"

echo "→ 0019: posts, pieces and reports…"
has_column User canPost || q 'ALTER TABLE "User" ADD COLUMN "canPost" BOOLEAN NOT NULL DEFAULT false;' >/dev/null || stop "couldn't add User.canPost."
q 'CREATE TABLE IF NOT EXISTS "Post" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "imageKey" TEXT NOT NULL, "width" INTEGER NOT NULL, "height" INTEGER NOT NULL, "caption" TEXT, "styleTags" TEXT NOT NULL DEFAULT '"'"'[]'"'"', "occasionTags" TEXT NOT NULL DEFAULT '"'"'[]'"'"', "status" TEXT NOT NULL DEFAULT '"'"'published'"'"', "likeCount" INTEGER NOT NULL DEFAULT 0, "saveCount" INTEGER NOT NULL DEFAULT 0, "reportCount" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE);' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "Post_status_createdAt_idx" ON "Post"("status", "createdAt");' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");' >/dev/null &&
q 'CREATE TABLE IF NOT EXISTS "PostItem" ("id" TEXT NOT NULL PRIMARY KEY, "postId" TEXT NOT NULL, "position" INTEGER NOT NULL, "name" TEXT NOT NULL, "category" TEXT, "brand" TEXT, "store" TEXT, "link" TEXT, "price" TEXT, "imageKey" TEXT, "closetItemId" TEXT, CONSTRAINT "PostItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PostItem_closetItemId_fkey" FOREIGN KEY ("closetItemId") REFERENCES "ClothingItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE);' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "PostItem_postId_idx" ON "PostItem"("postId");' >/dev/null &&
q 'CREATE TABLE IF NOT EXISTS "PostReport" ("id" TEXT NOT NULL PRIMARY KEY, "postId" TEXT NOT NULL, "reporterId" TEXT NOT NULL, "reason" TEXT NOT NULL, "note" TEXT, "status" TEXT NOT NULL DEFAULT '"'"'open'"'"', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" DATETIME, CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PostReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE);' >/dev/null &&
q 'CREATE UNIQUE INDEX IF NOT EXISTS "PostReport_postId_reporterId_key" ON "PostReport"("postId", "reporterId");' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "PostReport_status_createdAt_idx" ON "PostReport"("status", "createdAt");' >/dev/null ||
  stop "couldn't add the posts tables."
# A PostItem table made before the price field existed gets it too.
has_column PostItem price || q 'ALTER TABLE "PostItem" ADD COLUMN "price" TEXT;' >/dev/null || stop "couldn't add PostItem.price."
record 0019_posts.sql || stop "couldn't record 0019."
echo "✓ 0019 done"

echo "→ 0020: likes and saves…"
q 'CREATE TABLE IF NOT EXISTS "PostReaction" ("userId" TEXT NOT NULL, "postId" TEXT NOT NULL, "kind" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("userId", "postId"), CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE);' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "PostReaction_postId_kind_idx" ON "PostReaction"("postId", "kind");' >/dev/null &&
q 'CREATE TABLE IF NOT EXISTS "PostSave" ("userId" TEXT NOT NULL, "postId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("userId", "postId"), CONSTRAINT "PostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE);' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "PostSave_userId_createdAt_idx" ON "PostSave"("userId", "createdAt");' >/dev/null ||
  stop "couldn't add the likes and saves tables."
record 0020_post_reactions.sql || stop "couldn't record 0020."
echo "✓ 0020 done"

echo "→ Checking everything is in place…"
for c in username bio avatarKey canPost; do has_column User "$c" || stop "User.$c isn't showing."; done
for o in User_username_key Post PostItem PostReport PostReaction PostSave; do has_object "$o" || stop "$o isn't showing."; done
has_column PostItem price || stop "PostItem.price isn't showing."
echo "✓ All in place"

echo "→ Pushing the code (this starts the live build)…"
git push origin closet-shelf:main && echo "✓ Pushed. Tell Claude \"pushed\" and it will watch the build and check the live site."
