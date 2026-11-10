#!/bin/bash
# Go live with billing: the 7-day Plus trial and VIRM Plus ($14.99/month) with REAL payments.
#
# Run it only after you've said "go live" for billing. It asks you to paste ONE thing: your Stripe LIVE secret key
# (it starts with sk_live_). What you type isn't shown, saved to a file or printed. Then it:
#   1. checks the key is a live key and your Stripe account can take payments;
#   2. creates (once) the live "Virm Plus" product and its $14.99/month price;
#   3. creates the webhook that tells Virm about payments (its secret goes straight into Cloudflare, never shown);
#   4. checks Stripe's "Manage Plus" page is set up;
#   5. backs up the live database and adds the billing tables (0016) and invite codes (0017): both only add; nothing
#      existing changes;
#   6. saves the billing settings as Cloudflare secrets, with the on-switch (BILLING_ENABLED) last;
#   7. pushes the code, which turns on the trial, Plus and the monthly limits (people are stopped at their limit).
# It stops at the first problem; nothing is pushed unless every step works. Safe to run again.
set -u
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$HOME/bin:$PATH"
DB=a80603c0-a14f-469c-ac32-05506a25371e
WORKER=virm-virtualmirror
WEBHOOK_URL="https://virm-virtualmirror.yonghaochen.workers.dev/api/billing/webhook"
EVENTS=(checkout.session.completed customer.subscription.created customer.subscription.updated customer.subscription.deleted invoice.payment_failed)
BACKUP="$HOME/Documents/virm-backups/$(date +%Y-%m-%d)-billing-go-live"
stop() { echo "✗ Stopped: $1"; echo "  Nothing was pushed."; exit 1; }

# ---- 0. The code to publish -------------------------------------------------------------------------------------
[ "$(git rev-parse --abbrev-ref HEAD)" = "closet-shelf" ] || stop "switch to the closet-shelf branch first."
git fetch -q origin main || stop "couldn't reach GitHub."
git merge-base --is-ancestor origin/main HEAD || stop "the live site has changes this branch doesn't. Ask Claude to merge them in first."
[ -z "$(git status --porcelain -- src migrations prisma cloudflare.config.ts package.json package-lock.json)" ] ||
  stop "there are unsaved code changes. Ask Claude to commit them first."

# ---- 1. The live key (hidden) -----------------------------------------------------------------------------------
echo "Paste your Stripe LIVE secret key (starts with sk_live_). It won't show as you paste; press Return after."
read -rs KEY; echo
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
echo "  (got ${#KEY} characters; a Stripe key is usually about 100)"
[ "$(printf '%s' "$KEY" | grep -o '_live_' | wc -l | tr -d ' ')" = 1 ] || { KEY=""; stop "that looks like the key was pasted more than once. Run the script again and paste it once."; }
case "$KEY" in sk_live_*|rk_live_*) ;; *) KEY=""; stop "that isn't a live secret key (it should start with sk_live_).";; esac

# Stripe calls with the key passed privately (not visible to other programs on this Mac).
api() { # METHOD PATH [form fields…] → JSON
  local method=$1 endpoint=$2; shift 2
  local args=() f; for f in "$@"; do args+=(--data-urlencode "$f"); done
  curl -sS -X "$method" "https://api.stripe.com/v1/$endpoint" -K - ${args[@]+"${args[@]}"} <<<"user = \"$KEY:\""
}
json() { python3 -c "import json,sys
try: d=json.load(sys.stdin)
except Exception: d={}
for k in sys.argv[1].split('.'): d=d[int(k)] if isinstance(d,list) else (d or {}).get(k)
print('' if d is None else d)" "$1"; }

echo "→ Checking your Stripe account…"
ACCOUNT=$(api GET account) || stop "couldn't reach Stripe."
[ -n "$(echo "$ACCOUNT" | json error.message)" ] && stop "Stripe said: $(echo "$ACCOUNT" | json error.message)"
[ "$(echo "$ACCOUNT" | json charges_enabled)" = "True" ] || stop "your Stripe account can't take payments yet. Finish activating it on stripe.com (business details and bank account), then run this again."
echo "✓ Live account ready"

# ---- 2. Product and price (made once; Stripe's duplicate guard makes re-runs reuse them) ------------------------
echo "→ Virm Plus, \$14.99/month…"
PRODUCT=$(curl -sS https://api.stripe.com/v1/products -K - -H "Idempotency-Key: virm-plus-product-live-v1" \
  --data-urlencode "name=Virm Plus" \
  --data-urlencode "description=More photo and live try-ons, clothing photos and Style It searches each month." <<<"user = \"$KEY:\"" | json id)
[ -n "$PRODUCT" ] || stop "couldn't create the Virm Plus product."
PRICE=$(curl -sS https://api.stripe.com/v1/prices -K - -H "Idempotency-Key: virm-plus-price-1499-monthly-live-v1" \
  -d product="$PRODUCT" -d unit_amount=1499 -d currency=usd -d "recurring[interval]=month" <<<"user = \"$KEY:\"" | json id)
case "$PRICE" in price_*) ;; *) stop "couldn't create the \$14.99 price.";; esac
echo "✓ Product and price ready"

# ---- 3. Webhook (Stripe shows its secret only when it's made, so an existing one is replaced) -------------------
echo "→ The payment-messages webhook…"
for old in $(api GET "webhook_endpoints?limit=100" | python3 -c "import json,sys
for e in json.load(sys.stdin).get('data',[]):
  if e.get('url')==sys.argv[1]: print(e['id'])" "$WEBHOOK_URL"); do
  api DELETE "webhook_endpoints/$old" >/dev/null
done
ev=(); for e in "${EVENTS[@]}"; do ev+=("enabled_events[]=$e"); done
HOOK=$(api POST webhook_endpoints "url=$WEBHOOK_URL" "description=Virm billing" "${ev[@]}")
WHSEC=$(echo "$HOOK" | json secret)
case "$WHSEC" in whsec_*) ;; *) stop "couldn't create the webhook: $(echo "$HOOK" | json error.message)";; esac
echo "✓ Webhook ready"

# ---- 4. Stripe's Manage Plus page ---------------------------------------------------------------------------------
echo "→ The Manage Plus page…"
PORTAL=$(api GET "billing_portal/configurations?is_default=true&limit=1" | json data.0.id)
[ -n "$PORTAL" ] || stop "Stripe's customer portal isn't set up in live mode yet. On stripe.com open Settings → Billing → Customer portal, turn on: cancel at end of billing period, update payment methods, invoice history; press Save. Then run this again."
echo "✓ Manage Plus page ready"

# ---- 5. Database --------------------------------------------------------------------------------------------------
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

echo "→ Backing up the live database to $BACKUP …"
mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
for t in User ClothingItem Outfit OutfitItem OutfitPlan CreditEntry StudioReport Feedback AnalyticsEvent Pick PickVote d1_migrations; do
  q "SELECT * FROM \"$t\";" > "$BACKUP/$t.json" || stop "couldn't back up $t. Nothing was changed."
  [ -s "$BACKUP/$t.json" ] || stop "the $t backup is empty. Nothing was changed."
done
chmod 600 "$BACKUP"/*.json
echo "✓ Backed up"

echo "→ 0016: the billing tables…"
for c in trialStartedAt trialEndsAt stripeCustomerId trialCardFingerprint; do
  type=TEXT; case "$c" in trial*At) type=DATETIME;; esac
  has_column User "$c" || q "ALTER TABLE \"User\" ADD COLUMN \"$c\" $type;" >/dev/null || stop "couldn't add User.$c."
done
q 'CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "User_trialCardFingerprint_idx" ON "User"("trialCardFingerprint");' >/dev/null &&
q 'CREATE TABLE IF NOT EXISTS "Subscription" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "stripeSubscriptionId" TEXT NOT NULL, "stripeCustomerId" TEXT NOT NULL, "plan" TEXT NOT NULL DEFAULT '"'"'plus'"'"', "priceId" TEXT NOT NULL, "status" TEXT NOT NULL, "currentPeriodEnd" DATETIME, "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false, "canceledAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE);' >/dev/null &&
q 'CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");' >/dev/null &&
q 'CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_one_open_per_user" ON "Subscription"("userId") WHERE "status" IN ('"'"'incomplete'"'"', '"'"'active'"'"', '"'"'past_due'"'"', '"'"'unpaid'"'"');' >/dev/null &&
q 'CREATE TABLE IF NOT EXISTS "BillingEvent" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "userId" TEXT, "outcome" TEXT, "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" DATETIME);' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "BillingEvent_type_receivedAt_idx" ON "BillingEvent"("type", "receivedAt");' >/dev/null ||
  stop "couldn't add the billing tables."
recorded 0016_billing.sql || q "INSERT INTO d1_migrations (name) VALUES ('0016_billing.sql');" >/dev/null || stop "couldn't record 0016."
for o in Subscription BillingEvent Subscription_one_open_per_user User_stripeCustomerId_key; do has_object "$o" || stop "$o isn't showing."; done
has_column User trialCardFingerprint || stop "the new User columns aren't showing."
echo "✓ 0016 done"

echo "→ 0017: invite codes…"
for c in inviteCode invitedById; do
  has_column User "$c" || q "ALTER TABLE \"User\" ADD COLUMN \"$c\" TEXT;" >/dev/null || stop "couldn't add User.$c."
done
q 'CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteCode_key" ON "User"("inviteCode");' >/dev/null &&
q 'CREATE INDEX IF NOT EXISTS "User_invitedById_idx" ON "User"("invitedById");' >/dev/null || stop "couldn't add the invite-code indexes."
recorded 0017_invite_codes.sql || q "INSERT INTO d1_migrations (name) VALUES ('0017_invite_codes.sql');" >/dev/null || stop "couldn't record 0017."
has_column User inviteCode && has_column User invitedById && has_object User_inviteCode_key || stop "the invite-code columns aren't showing."
echo "✓ 0017 done"

# ---- 6. Cloudflare secrets (the on-switch last) -------------------------------------------------------------------
secret() { npx cf workers secrets update "$1" --worker "$WORKER" --type secret_text --text "$2" -q >/dev/null 2>/tmp/virm-golive.err ||
  { echo "   $(head -2 /tmp/virm-golive.err)"; stop "couldn't save the $1 secret in Cloudflare."; }; }
echo "→ Saving the billing settings in Cloudflare…"
FP_SECRET=$(npx cf workers secrets get TRIAL_FINGERPRINT_SECRET --worker "$WORKER" -q >/dev/null 2>&1 && echo keep || openssl rand -hex 32)
secret STRIPE_SECRET_KEY "$KEY"
secret STRIPE_WEBHOOK_SECRET "$WHSEC"
secret STRIPE_PLUS_PRICE_ID "$PRICE"
# Kept if it already exists: changing it would stop old trials' card codes from matching new ones.
[ "$FP_SECRET" = keep ] || secret TRIAL_FINGERPRINT_SECRET "$FP_SECRET"
secret BILLING_ENABLED 1
KEY=""; WHSEC=""; FP_SECRET=""
echo "✓ Settings saved"

# ---- 7. Publish ---------------------------------------------------------------------------------------------------
echo "→ Pushing the code (this starts the live build)…"
git push origin closet-shelf:main && echo "✓ Pushed. Tell Claude \"pushed\" and it will watch the build and check the live site."
