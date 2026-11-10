import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "virm-virtualmirror",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        id: "a80603c0-a14f-469c-ac32-05506a25371e",
      }),
      UPLOADS: bindings.r2({ name: "virtual-mirror-uploads" }),
      ANTHROPIC_API_KEY: bindings.secret(),
      TRYON_PROVIDER: bindings.text("bfl-flux-vto"),
      // Credit limits stop people (not just counted): Free, Plus and the 7-day trial. "count" turns it back to record-only.
      CREDIT_ENFORCEMENT: bindings.text("block"),
      BFL_API_KEY: bindings.secret(),
      // Live Try On's real-time preview (Decart). Only admin accounts can start it (see /api/live/token).
      DECART_API_KEY: bindings.secret(),
      // Billing (Stripe). All secrets, so billing stays off anywhere they aren't set; BILLING_ENABLED=1 turns it on.
      STRIPE_SECRET_KEY: bindings.secret(),
      STRIPE_WEBHOOK_SECRET: bindings.secret(),
      STRIPE_PLUS_PRICE_ID: bindings.secret(),
      TRIAL_FINGERPRINT_SECRET: bindings.secret(),
      BILLING_ENABLED: bindings.secret(),
    },
  }),
});
