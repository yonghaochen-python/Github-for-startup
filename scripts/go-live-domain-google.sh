#!/bin/bash
# Go live with virmstyle.com (old addresses move to it) and the groundwork for "Continue with Google" (0024 adds
# User.googleSub; the button stays hidden until Google's settings are added). The database change only ADDS one empty
# column and its index; nothing existing changes. Safe to run again. Nothing is pushed unless every step succeeds.
set -u
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$HOME/bin:$PATH"
DB=a80603c0-a14f-469c-ac32-05506a25371e
BACKUP="$HOME/Documents/virm-backups/$(date +%Y-%m-%d)-google-go-live"
stop() { echo "✗ Stopped: $1"; echo "  Nothing was pushed."; exit 1; }

[ "$(git rev-parse --abbrev-ref HEAD)" = "closet-shelf" ] || stop "switch to the closet-shelf branch first."
git fetch -q origin main || stop "couldn't reach GitHub."
git merge-base --is-ancestor origin/main HEAD || stop "the live site has changes this branch doesn't. Ask Claude to merge them in first."
[ -z "$(git status --porcelain -- src migrations prisma cloudflare.config.ts package.json package-lock.json)" ] ||
  stop "there are unsaved code changes. Ask Claude to commit them first."

q() {
  for i in 1 2 3 4 5; do
    if npx cf d1 query "$DB" --sql "${1}" 2>/tmp/virm-golive.err; then return 0; fi
    echo "   (Cloudflare said: $(grep -m1 '\[' /tmp/virm-golive.err) — trying again…)" >&2; sleep 5
  done
  echo "   Failed:" >&2; head -3 /tmp/virm-golive.err >&2; return 1
}
has_column() { q "SELECT name FROM pragma_table_info('$1') WHERE name = '$2';" 2>/dev/null | grep -q "\"$2\""; }
has_object() { q "SELECT name FROM sqlite_master WHERE name = '$1';" 2>/dev/null | grep -q "\"$1\""; }
recorded() { q "SELECT name FROM d1_migrations WHERE name = '$1';" 2>/dev/null | grep -q "\"$1\""; }

echo "→ Backing up the accounts table to $BACKUP …"
mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
q 'SELECT * FROM "User";' > "$BACKUP/User.json" || stop "couldn't back up User. Nothing was changed."
[ -s "$BACKUP/User.json" ] || stop "the User backup is empty. Nothing was changed."
chmod 600 "$BACKUP"/*.json
echo "✓ Backed up"

echo "→ 0024: Google sign-in column…"
has_column User googleSub || q 'ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;' >/dev/null || stop "couldn't add User.googleSub."
q 'CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");' >/dev/null || stop "couldn't add its index."
recorded 0024_google_sign_in.sql || q "INSERT INTO d1_migrations (name) VALUES ('0024_google_sign_in.sql');" >/dev/null || stop "couldn't record 0024."
has_column User googleSub && has_object User_googleSub_key || stop "the new column isn't showing."
echo "✓ 0024 done"

echo "→ Pushing the code (this starts the live build)…"
git push origin closet-shelf:main && echo "✓ Pushed. Tell Claude \"pushed\" and it will watch the build and check the live site."
