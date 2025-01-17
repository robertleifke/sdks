import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    testTimeout: 50_000,
    globalSetup: ["src/test/globalSetup.ts"],
  },
});
