import { defineConfig } from "vitest/config";

// Temporal (ADR-0009) をテストでも使えるよう、実行前に polyfill を読み込む。
export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
  },
});
