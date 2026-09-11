import { defineConfig } from "vitest/config";

// Temporal (ADR-0007) をテストでも使えるよう、実行前に polyfill を読み込む。
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    // exclude は既定値を置き換える (足すのではない)。.claude/ を外すのが目的で、
    // 既定にあった node_modules・dist はここに書き直している。理由:
    // .claude/worktrees/ に置いた別の worktree のテストまで拾ってしまい、
    // そちらの src/setup.ts はこの設定の setupFiles が configure() したものとは
    // 別モジュールになるため、getSetup() が「未設定です」で throw する。
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**", "**/out/**"],
  },
});
