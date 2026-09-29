import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

// Only used by the Prisma CLI (generate/migrate), never at runtime — the deployed
// app talks to its real database separately, so this placeholder is safe to
// hardcode rather than requiring a DATABASE_URL env var in every build environment.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
