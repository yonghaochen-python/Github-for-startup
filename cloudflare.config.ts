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
      BFL_API_KEY: bindings.secret(),
    },
  }),
});
