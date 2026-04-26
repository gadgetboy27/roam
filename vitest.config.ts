import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    timeout: 15000,
    pool: "forks",
    include: ["tests/**/*.test.ts"],
    exclude: [".cache/**", "node_modules/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
