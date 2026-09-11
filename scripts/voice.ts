// 使い方: tsx scripts/voice.ts [slug] [--watch]
//
// projects/<slug>/timeline.ts を静的解析し (scripts/voice/extract.ts)、
// line() ごとの音声キャッシュ (public/projects/<slug>/lines/<key>.{wav,json}、
// ADR-0010) を VOICEVOX ENGINE で生成する (scripts/voice/generate.ts)。
// slug は引数 → REMOTION_PROJECT → app/config.ts の defaultProject の順で
// 決める。
//
// 利用側のルートは cwd (ADR-0012)。projects/・characters/・public/・.env・
// app/config.ts はすべて cwd から引く。
//
// 既定 (--watch 無し) は 1 回生成して終了する (npm run render の前段)。
// --watch は projects/<slug>/ ディレクトリの変更を fs.watch で監視し、
// timeline.ts の変更のたびに再生成する (npm run dev から scripts/dev.ts が
// 起動する)。VOICEVOX_URL は .env で渡す。未設定なら 1 回実行は非 0 で
// 終了し、--watch は起動時に 1 度警告して何もしない (npm run dev 自体は
// 使える)。

import "temporal-polyfill/global";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveProjectSlug } from "../src/project/load.ts";
import { configure } from "../src/setup.ts";
import type { Theme } from "../src/setup.ts";
import { extractLines } from "./voice/extract.ts";
import { generateMissing } from "./voice/generate.ts";
import type { GenerateDeps } from "./voice/generate.ts";

try {
  process.loadEnvFile();
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;

  if (code !== "ENOENT") {
    throw error;
  }
}

// 利用側のルート。lib (このファイル) がどこに置かれていても、実行した
// ディレクトリを利用側のルートと見なす (ADR-0012)。
const consumerRoot = process.cwd();

/**
 * 利用側の app/config.ts を読み、configure() する。timeline の読み込みは
 * ここでは使わないため (静的解析だけを行う)、呼ばれたら throw する関数を渡す。
 *
 * theme の中身 (narrator の全項目・palette の色) は configure() が見るため、
 * ここは app/config.ts が読めて必要な値を export しているかだけを確かめる。
 */
export const configureFromConsumer = async (root: string): Promise<void> => {
  const configPath = path.join(root, "app", "config.ts");

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `${configPath} がありません (利用側のルートで実行してください)`,
    );
  }

  const config: unknown = await import(pathToFileURL(configPath).href);
  const { theme, defaultProject } = config as {
    theme?: Theme;
    defaultProject?: string;
  };

  if (theme === undefined) {
    throw new Error(`${configPath} が theme を export していません`);
  }

  if (typeof defaultProject !== "string") {
    throw new Error(
      `${configPath} が defaultProject (project の slug) を export していません`,
    );
  }

  try {
    configure({
      theme,
      defaultProject,
      loadTimeline: () => {
        throw new Error(
          "scripts/voice.ts は timeline.ts を静的解析するだけで、読み込みはしません",
        );
      },
    });
  } catch (error) {
    // configure() のメッセージは theme のどの項目かまでしか言わない。CLI から
    // は直すファイルが分かった方がよいので、読んだパスを添え直す。
    throw new Error(
      `${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** slug を CLI 引数 (先頭の非フラグ) → env (REMOTION_PROJECT) → 既定の順で決める。 */
export const resolveSlugArg = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): string => {
  const positional = argv.find((arg) => !arg.startsWith("--"));

  return resolveProjectSlug(positional ?? env.REMOTION_PROJECT);
};

/** VOICEVOX_URL を env から読む。未設定なら undefined。 */
export const readVoicevoxUrl = (env: NodeJS.ProcessEnv): string | undefined =>
  env.VOICEVOX_URL;

/**
 * run を要求ごとにデバウンスし、実行中に来た要求は 1 回の再実行に合流させる
 * 関数を作る。fs.watch のイベントバースト (1 回の保存で複数回発火する) を
 * まとめ、実行中の呼び出しと重ならないようにする。run が reject しても
 * running は必ず戻し (finally)、その要求のエラーは onError に渡す。reject
 * した実行中に来た再実行要求 (rerunRequested) も捨てず、次の 1 回として
 * 続けて走らせる (run 自身は catch しないこと。二重 catch を避けるため)。
 */
export const createRunQueue = (
  run: () => Promise<void>,
  delayMs: number,
  onError: (error: unknown) => void,
  setTimeoutFn: typeof setTimeout = setTimeout,
): (() => void) => {
  let running = false;
  let rerunRequested = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const runLoop = async (): Promise<void> => {
    if (running) {
      rerunRequested = true;
      return;
    }

    running = true;
    try {
      do {
        rerunRequested = false;
        try {
          await run();
        } catch (error) {
          onError(error);
        }
      } while (rerunRequested);
    } finally {
      running = false;
    }
  };

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeoutFn(() => {
      debounceTimer = null;
      void runLoop();
    }, delayMs);
  };
};

/**
 * 抽出した発話が 0 件のときに出す警告文 (1 件以上なら undefined)。発話の無い
 * project は正当なのでエラーにはしない。ただし timeline.ts の import が lib の
 * 入口を指していないときも 0 件になる (extract.ts は入口から入った line() だけを
 * 拾う) ため、黙って 0 件で終えずに確認を促す。
 */
export const noLinesWarning = (lineCount: number): string | undefined =>
  lineCount === 0
    ? "warn: 発話 (line()) が 0 件でした。timeline.ts の import が lib の入口 (src/compositions/index.ts か motovlog-template/compositions) を指しているか確認してください"
    : undefined;

const runOnce = async (slug: string, voicevoxUrl: string): Promise<void> => {
  const timelinePath = path.join(consumerRoot, "projects", slug, "timeline.ts");
  const source = fs.readFileSync(timelinePath, "utf-8");
  const lines = await extractLines(source, timelinePath);
  const warning = noLinesWarning(lines.length);

  if (warning !== undefined) {
    process.stderr.write(`${warning}\n`);
  }

  const publicDir = path.join(consumerRoot, "public");
  const linesDir = path.join(publicDir, "projects", slug, "lines");

  const deps: GenerateDeps = {
    linesDir,
    publicDir,
    voicevoxUrl,
    fetchImpl: fetch,
    exists: (p) => fs.existsSync(p),
    mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
    writeFile: (p, data) => fs.writeFileSync(p, data),
    rename: (from, to) => fs.renameSync(from, to),
    log: (line) => process.stdout.write(`${line}\n`),
    warn: (line) => process.stderr.write(`${line}\n`),
    now: () => Temporal.Now.instant().toString(),
  };

  await generateMissing(slug, lines, deps);
};

/** run() が返す、--watch 時の監視の後片付け手段。--watch でなければ何もしない。 */
export type RunHandle = { close: () => void };

const noopHandle: RunHandle = { close: () => {} };

/**
 * CLI 引数を解釈して 1 回生成 (既定) または --watch を起動する。
 * scripts/dev.ts が --watch 相当を同プロセスで起動するために呼ぶ。
 */
export const run = async (args: readonly string[]): Promise<RunHandle> => {
  const watch = args.includes("--watch");

  // slug の既定値は利用側の app/config.ts が持つため、slug を決める前に読む。
  await configureFromConsumer(consumerRoot);

  const slug = resolveSlugArg(
    args.filter((arg) => arg !== "--watch"),
    process.env,
  );
  const voicevoxUrl = readVoicevoxUrl(process.env);

  if (!voicevoxUrl) {
    if (!watch) {
      throw new Error(
        "VOICEVOX_URL を設定してください (例: http://localhost:50021)",
      );
    }

    process.stderr.write(
      "warn: VOICEVOX_URL が未設定のため発話の生成をしません (.env を設定してください)\n",
    );
    return noopHandle;
  }

  if (!watch) {
    await runOnce(slug, voicevoxUrl);
    return noopHandle;
  }

  const projectDir = path.join(consumerRoot, "projects", slug);

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(
      `warn: ${projectDir} が無いため監視しません (先に project を作ってください)\n`,
    );
    return noopHandle;
  }

  const logRunError = (error: unknown): void => {
    process.stderr.write(
      `error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  };

  // 初回は watcher 起動前に 1 度実行する。失敗しても watch は続ける。
  try {
    await runOnce(slug, voicevoxUrl);
  } catch (error) {
    logRunError(error);
  }

  // timeline.ts に直接 fs.watch を張ると、rename 保存 (エディタの
  // writebackup 等) で最初の保存後に監視対象が入れ替わり、以降の変更を
  // 拾えなくなる。ディレクトリを監視し、timeline.ts のイベントだけ拾う。
  const requestRun = createRunQueue(
    () => runOnce(slug, voicevoxUrl),
    200,
    logRunError,
  );

  const watcher = fs.watch(projectDir, (_eventType, filename) => {
    if (filename === "timeline.ts") {
      requestRun();
    }
  });

  // line() の by は characters/<name>.ts の voice を辿るため (ADR-0011)、
  // そちらの変更でも再生成する。timeline.ts 自体は変わらないため、上の
  // ディレクトリ監視だけでは拾えない。projectDir の監視と同じく非
  // 再帰で張る (characters/ にサブディレクトリは無い想定)。
  const charactersDir = path.join(consumerRoot, "characters");
  let charactersWatcher: fs.FSWatcher | undefined;

  if (fs.existsSync(charactersDir)) {
    charactersWatcher = fs.watch(charactersDir, (_eventType, filename) => {
      if (filename?.endsWith(".ts")) {
        requestRun();
      }
    });
  } else {
    process.stderr.write("warn: characters/ が無いため監視しません\n");
  }

  process.stdout.write(`watch: ${projectDir}\n`);

  return {
    close: () => {
      watcher.close();
      charactersWatcher?.close();
    },
  };
};

// tsx で直接実行されたときだけ CLI として動く (scripts/dev.ts からの import では動かない)。
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message}\n`);
    process.exitCode = 1;
  });
}
