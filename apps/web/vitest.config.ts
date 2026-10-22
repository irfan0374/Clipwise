import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  // tsconfig keeps jsx "preserve" for Next.js; tests compile JSX themselves
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["test/**/*.test.ts"] },
});
