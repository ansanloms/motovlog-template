// 使い方: npm run convert -- [--fps=<n>] <slug> <入力ファイル>...
// 各入力を public/projects/<slug>/<basename>.mp4 へ変換する (ADR-0003)。
// fps は --fps=<n> で指定し、既定は 30 (T&M の値)。composition の fps と
// 一致させること (ADR-0003)。
// 起動時に nvenc が使えるかを確認し、使えなければ libx264 を使う。nvenc が使える場合でも、
// あるファイルの変換に失敗したときはそのファイルだけ libx264 で再試行する。

import "temporal-polyfill/global";
import { spawn, spawnSync } from "node:child_process";
import fs, { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConvertAbortedError,
  gopFromFps,
  outputName,
  parseConvertArgs,
  runConvert,
  USAGE,
} from "./convert/plan.ts";
import type { ConvertDeps } from "./convert/plan.ts";

const main = async (): Promise<void> => {
  let slug: string;
  let inputs: string[];
  let fps: number;

  try {
    const parsed = parseConvertArgs(process.argv.slice(2));

    if (parsed === null) {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
      return;
    }

    ({ slug, inputs, fps } = parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
    return;
  }

  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).error) {
    process.stderr.write("error: ffmpeg が必要です\n");
    process.exit(1);
    return;
  }

  const repoRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const outDir = path.join(repoRoot, "public", "projects", slug);

  // 変換に入る前に、出力先が未生成の入力ファイルが読めることを確認する。
  // 出力が既に存在する入力は変換済みで原本が未マウントの場合があるため確認をスキップする。
  for (const inFile of inputs) {
    const outFile = path.join(outDir, `${outputName(inFile)}.mp4`);

    if (fs.existsSync(outFile)) {
      continue;
    }

    try {
      fs.accessSync(inFile, fsConstants.R_OK);
    } catch {
      process.stderr.write(`error: 入力ファイルが読めません: ${inFile}\n`);
      process.exit(1);
      return;
    }
  }

  const gop = gopFromFps(fps);

  let currentTmp: string | null = null;
  let currentChild: ReturnType<typeof spawn> | null = null;
  // シグナル受信時に、実行中の ffmpeg を止めたうえで nvenc → libx264 の
  // 再試行のような新規 ffmpeg 起動をしないことを runConvert 側に伝える。
  const controller = new AbortController();

  const deps: ConvertDeps = {
    ffmpeg: (ffmpegArgs, env) =>
      new Promise((resolve) => {
        // 中断後は新しい ffmpeg プロセスを作らない。
        if (controller.signal.aborted) {
          resolve(1);
          return;
        }

        const child = spawn("ffmpeg", ffmpegArgs, { env, stdio: "inherit" });
        currentChild = child;
        child.on("close", (code) => {
          currentChild = null;
          resolve(code ?? 1);
        });
        // spawn 自体の失敗 (ffmpeg が見つからない等) は close ではなく error で
        // 通知される。Promise の resolve は冪等なので、先に close が resolve
        // していればこの呼び出しは無視される。
        child.on("error", (error) => {
          currentChild = null;
          process.stderr.write(
            `error: ffmpeg を起動できません: ${error.message}\n`,
          );
          resolve(1);
        });
      }),
    exists: (p) => fs.existsSync(p),
    mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
    rename: (from, to) => fs.renameSync(from, to),
    unlink: (p) => fs.rmSync(p, { force: true }),
    log: (line) => process.stdout.write(`${line}\n`),
    warn: (line) => process.stderr.write(`${line}\n`),
    env: process.env,
    onTmp: (p) => {
      currentTmp = p;
    },
  };

  const cleanupTmp = () => {
    if (currentTmp) {
      fs.rmSync(currentTmp, { force: true });
    }
  };

  // child の "close" を待つ。timeoutMs 以内に閉じなければ false を返す
  // (呼び出し側で SIGKILL に切り替える)。
  const waitForClose = (
    child: ReturnType<typeof spawn>,
    timeoutMs: number,
  ): Promise<boolean> =>
    new Promise((resolve) => {
      const onClose = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        child.off("close", onClose);
        resolve(false);
      }, timeoutMs);
      child.once("close", onClose);
    });

  const SIGNAL_NUMBERS = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } as const;

  // 1 回目のシグナルでは、実行中の ffmpeg に SIGTERM を送って 5 秒待ち、
  // 閉じなければ SIGKILL を送ってさらに 5 秒待つ (通常の中断経路)。
  // controller.abort() → 実行中の ffmpeg の close → deps.ffmpeg が resolve
  // → runConvert が abort を検知して tmp を消して ConvertAbortedError を
  // 投げる → main の catch、という経路で自然に終了する。
  // 2 回目以降のシグナルは、上記の経路を待たず ffmpeg に SIGKILL を送って
  // 即座に process.exit で終了する (process.on("exit", cleanupTmp) が
  // tmp を消す)。SIGKILL 後も ffmpeg が終了しない場合も同様に即終了する。
  let shuttingDown = false;

  const handleSignal = async (
    name: keyof typeof SIGNAL_NUMBERS,
  ): Promise<void> => {
    const signalNumber = SIGNAL_NUMBERS[name];

    if (shuttingDown) {
      currentChild?.kill("SIGKILL");
      fs.writeSync(2, "強制終了します\n");
      process.exit(128 + signalNumber);
      return;
    }
    shuttingDown = true;

    controller.abort();

    if (currentChild) {
      const child = currentChild;
      child.kill("SIGTERM");

      if (!(await waitForClose(child, 5000))) {
        child.kill("SIGKILL");

        if (!(await waitForClose(child, 5000))) {
          fs.writeSync(2, "ffmpeg が終了しないため強制終了します\n");
          process.exit(128 + signalNumber);
          return;
        }
      }
    }

    process.exitCode = 128 + signalNumber;
  };

  process.on("SIGINT", () => void handleSignal("SIGINT"));
  process.on("SIGTERM", () => void handleSignal("SIGTERM"));
  process.on("SIGHUP", () => void handleSignal("SIGHUP"));
  // 最終防衛: 上記シグナルハンドラを経ずに終了する経路 (例外・正常終了) でも
  // tmp が残らないようにする。cleanupTmp は force なので二重に呼んでも無害。
  process.on("exit", cleanupTmp);

  await runConvert(
    { inputs, outDir, fps, gop, signal: controller.signal },
    deps,
  );
};

main().catch((error: unknown) => {
  if (error instanceof ConvertAbortedError) {
    process.stderr.write("中断しました\n");
    // シグナルハンドラが exitCode を設定していればそれを尊重する。
    process.exitCode ??= 1;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
});
