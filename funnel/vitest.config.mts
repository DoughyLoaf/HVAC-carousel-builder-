import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60000 },
  resolve: {
    alias: {
      "@content": path.resolve(import.meta.dirname, "content"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
