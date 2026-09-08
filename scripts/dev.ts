// 使い方: npm run dev -- [remotion studio の引数...]
//
// scripts/voice.ts の --watch 相当 (発話の音声キャッシュ生成の監視) を同
// プロセスで起動してから、remotion studio を子プロセス (stdio 継承、CLI
// 引数はそのまま渡す) で起こす。子プロセスの終了で dev.ts も終了し、
// SIGINT/SIGTERM は子に伝えてから終わる。

import { spawn } from "node:child_process";
import { run as runVoiceWatch } from "./voice.ts";

const main = async (): Promise<void> => {
  // .env の読み込み (scripts/voice.ts のモジュール読み込み時の副作用) を
  // 経てから起動するため、REMOTION_PROJECT 等は子プロセス (remotion studio)
  // にも process.env 経由でそのまま引き継がれる。
  const watch = await runVoiceWatch(["--watch"]);

  const child = spawn("remotion", ["studio", ...process.argv.slice(2)], {
    stdio: "inherit",
  });

  const forwardSignal = (signal: NodeJS.Signals): void => {
    child.kill(signal);
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  // watcher (fs.watch) が event loop を生かし続けるため、子の終了後は
  // watcher を close してから終わる。シグナルで終わる経路は、再送の前に
  // 自分のハンドラ (上記の process.on) を外し、既定の (プロセスを終わらせる)
  // 挙動に任せる。どちらの経路でも close 後に明示的に終えて、終われない
  // 経路を残さない。
  const finish = (code: number, signal: NodeJS.Signals | null): void => {
    watch.close();

    if (signal) {
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code);
  };

  child.on("close", (code, signal) => {
    finish(code ?? 1, signal);
  });

  child.on("error", (error) => {
    watch.close();
    process.stderr.write(
      `error: remotion studio を起動できません: ${error.message}\n`,
    );
    process.exit(1);
  });
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
});
