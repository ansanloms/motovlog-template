// convert-movie.ts のロジック (純粋関数 + 変換の手順)。fs・child_process は
// import せず、実際の I/O は呼び出し側 (convert-movie.ts) が ConvertDeps 経由で渡す。
// テストしやすくするための分離。

import path from "node:path";
import { PROJECT_SLUG_PATTERN } from "../../src/project/load.ts";

// slug の形式 (ADR-0002) は project を読む側 (src/project/load.ts) と同じ
// ものを使う。ここからも再 export して、この層の利用者が src を辿らずに
// 済むようにする。
export { PROJECT_SLUG_PATTERN };

export const USAGE = "usage: npm run convert -- <slug> <入力ファイル>...";

/**
 * convert-movie.ts の CLI 引数を解釈する。先頭を slug、以降を inputs とする。
 * `--help`・`-h` があれば null を返す (呼び出し側が usage を出す)。それ以外の
 * `--` で始まる引数は不明なオプションとして拒否する。
 */
export const parseConvertArgs = (
  args: readonly string[],
): { slug: string; inputs: string[] } | null => {
  if (args.some((arg) => arg === "--help" || arg === "-h")) {
    return null;
  }

  const bad = args.find((a) => a.startsWith("--"));

  if (bad) {
    throw new Error(`不明なオプションです: ${bad}`);
  }

  const [slug, ...inputs] = args;

  if (!slug || inputs.length === 0) {
    throw new Error(USAGE);
  }

  if (!PROJECT_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `slug は YYYYMMDD-<name> (ASCII 小文字の kebab-case) の形にしてください: ${slug}`,
    );
  }

  return { slug, inputs };
};

// ffmpeg の -g は整数しか受けないため、fps を四捨五入した値を GOP 長
// (1 秒ごとのキーフレーム) にする。fps が 0 または 0.x だと gop が 0 になり
// -g に渡せないため拒否する。
export const gopFromFps = (fps: number): number => {
  const gop = Math.round(fps);

  if (gop < 1) {
    throw new Error(
      `fps (src/theme/timing.ts) が不正です (正の数で、丸めた値が 1 以上): ${fps}`,
    );
  }

  return gop;
};

// 入力ファイルの basename から拡張子を除いた出力名を返す (bash の
// ${base_name%.*} と同じ挙動: 最後の "." 以降を除く。"." が無ければそのまま。
// ".mp4" のように名前部分が空になる場合は拒否する)。
export const outputName = (inFile: string): string => {
  const baseName = path.basename(inFile);
  const dotIndex = baseName.lastIndexOf(".");
  const name = dotIndex === -1 ? baseName : baseName.slice(0, dotIndex);

  if (name === "") {
    throw new Error(`ファイル名が拡張子だけです: ${inFile}`);
  }

  return name;
};

// 出力先は basename (拡張子除く) だけで決まるため、拡張子違いの重複入力が
// あると後勝ちで上書きしてしまう。事前に検出して拒否する。
export const checkDuplicateOutputs = (inFiles: string[]): void => {
  const seen = new Map<string, string>();

  for (const inFile of inFiles) {
    const name = outputName(inFile);
    const prior = seen.get(name);

    if (prior !== undefined) {
      throw new Error(
        `出力先 (${name}.mp4) が重複しています: ${prior} と ${inFile}`,
      );
    }

    seen.set(name, inFile);
  }
};

// WSL で NVENC を使うための LD_LIBRARY_PATH。既存の値を上書きせず前に足す。
export const nvencEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const existing = env.LD_LIBRARY_PATH;

  return {
    ...env,
    LD_LIBRARY_PATH: existing
      ? `/usr/lib/wsl/lib:${existing}`
      : "/usr/lib/wsl/lib",
  };
};

// nvenc が使えるかを起動時に 1 回だけプローブするための ffmpeg 引数。
// プローブは本番と同じ encoder オプションで打つ。64x64 のような小さいフレームは
// 最小フレームサイズ未満で失敗し、GOP を 1 にすると B フレーム数の制約で失敗するため、
// 本番と同じ fps・GOP の 1 秒のテスト映像を使う。
export const probeArgs = (fps: number, gop: number): string[] => [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  `testsrc=duration=1:size=320x240:rate=${fps}`,
  "-r",
  String(fps),
  "-c:v",
  "h264_nvenc",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "p4",
  "-cq",
  "23",
  "-g",
  String(gop),
  "-f",
  "null",
  "-",
];

export type Encoder = "nvenc" | "libx264";

export const encodeArgs = (o: {
  encoder: Encoder;
  input: string;
  output: string;
  fps: number;
  gop: number;
}): string[] => {
  const { encoder, input, output, fps, gop } = o;

  if (encoder === "nvenc") {
    return [
      "-y",
      "-hwaccel",
      "cuda",
      "-i",
      input,
      "-r",
      String(fps),
      "-c:v",
      "h264_nvenc",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "p4",
      "-cq",
      "23",
      "-g",
      String(gop),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      output,
    ];
  }

  return [
    "-y",
    "-i",
    input,
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-g",
    String(gop),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    output,
  ];
};

export type ConvertDeps = {
  ffmpeg: (args: string[], env: NodeJS.ProcessEnv) => Promise<number>;
  exists: (p: string) => boolean;
  mkdir: (dir: string) => void;
  rename: (from: string, to: string) => void;
  unlink: (p: string) => void;
  log: (line: string) => void;
  warn: (line: string) => void;
  env: NodeJS.ProcessEnv;
  // 変換途中で失敗・中断した場合に不完全な出力ファイルが残らないよう、現在の
  // 一時ファイルパスを呼び出し側に伝える (シグナル受信時の削除に使う)。
  onTmp: (p: string | null) => void;
};

// シグナルによる中断を呼び出し側 (convert-movie.ts) に伝えるための専用エラー。
// 通常の失敗 (Error) と区別できるよう、main 側でメッセージを出し分ける。
export class ConvertAbortedError extends Error {
  constructor() {
    super("中断されました");
    this.name = "ConvertAbortedError";
  }
}

// 各入力を <outDir>/<basename>.mp4 へ変換する (ADR-0003)。nvenc が使えるかを
// 起動時にプローブし、以降の変換はプローブ結果の encoder で統一する。nvenc が
// 使える場合でも、あるファイルの変換に失敗したときはそのファイルだけ libx264
// で再試行し、以降のファイルも libx264 に切り替える。signal が中断されたら、
// nvenc → libx264 の再試行はせず ConvertAbortedError を投げる。
export const runConvert = async (
  o: {
    inputs: string[];
    outDir: string;
    fps: number;
    gop: number;
    signal?: AbortSignal;
  },
  deps: ConvertDeps,
): Promise<void> => {
  const { inputs, outDir, fps, gop, signal } = o;

  let encoder: Encoder = "nvenc";
  const probeCode = await deps.ffmpeg(probeArgs(fps, gop), nvencEnv(deps.env));

  if (signal?.aborted) {
    throw new ConvertAbortedError();
  }

  if (probeCode !== 0) {
    encoder = "libx264";
    deps.warn("warn: nvenc が使えないため libx264 で変換します");
  }

  checkDuplicateOutputs(inputs);

  deps.mkdir(outDir);

  for (const inFile of inputs) {
    if (signal?.aborted) {
      throw new ConvertAbortedError();
    }

    const name = outputName(inFile);
    const output = path.join(outDir, `${name}.mp4`);

    if (deps.exists(output)) {
      deps.log(`skip: ${output} は既に存在します`);
      continue;
    }

    // 拡張子が .tmp のままだと ffmpeg が出力 muxer を推定できず失敗するため、
    // 拡張子は .mp4 のまま隠しファイル名で一時出力する。
    const tmp = path.join(outDir, `.tmp.${name}.mp4`);
    deps.onTmp(tmp);

    deps.log(`encode: ${inFile} -> ${output} (${encoder}, fps=${fps})`);
    let usedEncoder: Encoder = encoder;

    try {
      if (encoder === "nvenc") {
        const code = await deps.ffmpeg(
          encodeArgs({
            encoder: "nvenc",
            input: inFile,
            output: tmp,
            fps,
            gop,
          }),
          nvencEnv(deps.env),
        );

        if (signal?.aborted) {
          throw new ConvertAbortedError();
        }

        if (code !== 0) {
          deps.warn(
            `warn: nvenc に失敗したため libx264 で再試行します: ${inFile}`,
          );

          const retryCode = await deps.ffmpeg(
            encodeArgs({
              encoder: "libx264",
              input: inFile,
              output: tmp,
              fps,
              gop,
            }),
            deps.env,
          );

          if (signal?.aborted) {
            throw new ConvertAbortedError();
          }

          if (retryCode !== 0) {
            throw new Error(
              `ffmpeg が失敗しました (exit ${retryCode}): ${inFile}`,
            );
          }

          usedEncoder = "libx264";
          // 一度失敗した nvenc を残りのファイルでも試すと同じ失敗を繰り返す
          // だけなので、以降は最初から libx264 を使う。
          encoder = "libx264";
          deps.warn("warn: 以降のファイルは libx264 で変換します");
        }
      } else {
        const code = await deps.ffmpeg(
          encodeArgs({
            encoder: "libx264",
            input: inFile,
            output: tmp,
            fps,
            gop,
          }),
          deps.env,
        );

        if (signal?.aborted) {
          throw new ConvertAbortedError();
        }

        if (code !== 0) {
          throw new Error(`ffmpeg が失敗しました (exit ${code}): ${inFile}`);
        }
      }
    } catch (error) {
      deps.unlink(tmp);
      deps.onTmp(null);
      throw error;
    }

    try {
      deps.rename(tmp, output);
    } catch (error) {
      deps.unlink(tmp);
      deps.onTmp(null);
      throw error;
    }

    deps.onTmp(null);
    deps.log(`done: ${output} (${usedEncoder})`);
  }
};
