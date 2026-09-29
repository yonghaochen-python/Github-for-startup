import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "github-for-startup",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        id: "a80603c0-a14f-469c-ac32-05506a25371e",
        name: "virtual-mirror-db",
      }),
      UPLOADS: bindings.r2({ name: "virtual-mirror-uploads" }),
      ANTHROPIC_API_KEY: bindings.secret(),
    },
  }),
});
