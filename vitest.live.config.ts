import { defineConfig } from "vitest/config";
import { resolve } from "path";

// npm run test:live — runs tests/live against the Supabase project in .env.local.
// Use the TEST project only: these tests create and then remove their own members.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/live/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
