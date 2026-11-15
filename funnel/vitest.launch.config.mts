import { defineConfig } from "vitest/config";
import path from "node:path";

// Used only by `npm run launch:check`.
export default defineConfig({
  test: { include: ["scripts/launch-check.spec.ts"] },
  resolve: {
    alias: {
      "@content": path.resolve(import.meta.dirname, "content"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
