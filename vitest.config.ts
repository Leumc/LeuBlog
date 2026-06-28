import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Stub server-only and next/headers so pure-logic tests can import
      // server-side modules without Next.js runtime being present.
      "server-only": path.resolve(__dirname, "src/__mocks__/server-only.ts"),
      "next/headers": path.resolve(__dirname, "src/__mocks__/next-headers.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
