import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts"],
      exclude: ["server/__tests__/**", "server/types.ts", "server/index.ts"],
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
});
