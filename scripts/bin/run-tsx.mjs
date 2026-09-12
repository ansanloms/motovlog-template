// scripts/bin/*.mjs の共通処理 (ADR-0012)。外部リポジトリの利用側は tsx を
// 直接叩けない (依存として持たない) ため、tsx の CLI を子プロセスとして
// 起動し、このパッケージ内の scripts/<name>.ts を利用側の cwd のまま実行
// する。tsx/cli の解決は import.meta.resolve ではなく
// createRequire().resolve() を使う (import.meta.resolve は Node 20.6 未満
// で使えないため)。

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * tsx の CLI で scriptUrl (呼び出し元の `new URL("../<name>.ts",
 * import.meta.url)`) を実行する。process.argv.slice(2) をそのまま渡し、
 * SIGINT・SIGTERM を子プロセスへ転送し、子の終了 (終了コード、または
 * signal による終了) を自分の終了として伝播する。
 */
export const runTsx = (scriptUrl) => {
  const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
  const scriptPath = fileURLToPath(scriptUrl);

  const child = spawn(
    process.execPath,
    [tsxCli, scriptPath, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );

  const forwardSignal = (signal) => {
    child.kill(signal);
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("close", (code, signal) => {
    if (signal) {
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    process.stderr.write(`error: tsx を起動できません: ${error.message}\n`);
    process.exit(1);
  });
};
