// convert-movie.ts のロジック (純粋関数 + 変換の手順)。fs・child_process は
// import せず、実際の I/O は呼び出し側 (convert-movie.ts) が ConvertDeps 経由で渡す。
// 変換済み素材に加えて、そこから Studio 用プロキシ (ADR-0013、既定 540p、
// 環境変数 PREVIEW_HEIGHT で変更可) も作る。テストしやすくするための分離。

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
 *
 * 素の `--` (オプション終端) があれば、それより前だけを上記のオプション判定
 * (`--help`・`-h`・不明なオプション) の対象にし、それより後はすべて位置引数
 * (slug・inputs) として読む。`npm run convert -- <slug> <入力ファイル>...` は
 * npm が `--` 自体を落として渡すため影響しないが、`npx motovlog-convert --
 * <slug> <入力ファイル>...` は npx が `--` を落とさずそのまま渡すため、これを
 * 読み飛ばせないと `<slug>` の前に `--` が残って不明なオプション扱いになる。
 */
export const parseConvertArgs = (
  args: readonly string[],
): { slug: string; inputs: string[] } | null => {
  const separatorIndex = args.indexOf("--");
  const flags = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  const positional =
    separatorIndex === -1 ? args : args.slice(separatorIndex + 1);

  if (flags.some((arg) => arg === "--help" || arg === "-h")) {
    return null;
  }

  const bad = flags.find((a) => a.startsWith("--"));

  if (bad) {
    throw new Error(`不明なオプションです: ${bad}`);
  }

  const [slug, ...inputs] = positional;

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

/**
 * ffmpeg の -g は整数しか受けないため、fps を四捨五入した値を GOP 長
 * (1 秒ごとのキーフレーム) にする。fps が 0 または 0.x だと gop が 0 になり
 * -g に渡せないため拒否する。
 */
export const gopFromFps = (fps: number): number => {
  const gop = Math.round(fps);

  if (gop < 1) {
    throw new Error(
      `fps (src/theme/timing.ts) が不正です (正の数で、丸めた値が 1 以上): ${fps}`,
    );
  }

  return gop;
};

/**
 * 入力ファイルの basename から拡張子を除いた出力名を返す (bash の
 * ${base_name%.*} と同じ挙動: 最後の "." 以降を除く。"." が無ければそのまま。
 * ".mp4" のように名前部分が空になる場合は拒否する)。
 */
export const outputName = (inFile: string): string => {
  const baseName = path.basename(inFile);
  const dotIndex = baseName.lastIndexOf(".");
  const name = dotIndex === -1 ? baseName : baseName.slice(0, dotIndex);

  if (name === "") {
    throw new Error(`ファイル名が拡張子だけです: ${inFile}`);
  }

  return name;
};

/**
 * 出力先は basename (拡張子除く) だけで決まるため、拡張子違いの重複入力が
 * あると後勝ちで上書きしてしまう。事前に検出して拒否する。
 */
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

/** WSL で NVENC を使うための LD_LIBRARY_PATH。既存の値を上書きせず前に足す。 */
export const nvencEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const existing = env.LD_LIBRARY_PATH;

  return {
    ...env,
    LD_LIBRARY_PATH: existing
      ? `/usr/lib/wsl/lib:${existing}`
      : "/usr/lib/wsl/lib",
  };
};

/**
 * nvenc が使えるかを起動時に 1 回だけプローブするための ffmpeg 引数。
 * プローブは本番と同じ encoder オプションで打つ。64x64 のような小さいフレームは
 * 最小フレームサイズ未満で失敗し、GOP を 1 にすると B フレーム数の制約で失敗するため、
 * 本番と同じ fps・GOP の 1 秒のテスト映像を使う。
 */
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

/**
 * Studio 用プロキシ (ADR-0013) の高さの既定値。幅は `-2` でアスペクト比から
 * 自動で決める。環境変数 `PREVIEW_HEIGHT` (`.env`) で変えられる (下記
 * `previewHeight` 参照)。
 */
export const DEFAULT_PREVIEW_HEIGHT = 540;

/**
 * Studio 用プロキシ (ADR-0013) の高さを環境変数 `PREVIEW_HEIGHT` から読む。
 * 未設定・空文字なら `DEFAULT_PREVIEW_HEIGHT` (540)。yuv420p はクロマの
 * サブサンプリングのため縦横とも偶数を要求する (幅は `-2` が担う) ので、
 * 2 以上の偶数の整数以外は throw する。
 */
export const previewHeight = (env: NodeJS.ProcessEnv): number => {
  const raw = env.PREVIEW_HEIGHT?.trim();

  if (!raw) {
    return DEFAULT_PREVIEW_HEIGHT;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `PREVIEW_HEIGHT が不正です: ${raw} (2 以上の偶数を指定する)`,
    );
  }

  const value = Number.parseInt(raw, 10);

  if (value < 2 || value % 2 !== 0) {
    throw new Error(
      `PREVIEW_HEIGHT が不正です: ${raw} (2 以上の偶数を指定する)`,
    );
  }

  return value;
};

/**
 * 変換済み素材の出力名 (拡張子を除いた basename) から、Studio 用プロキシの
 * 出力名を返す (ADR-0013)。呼び出し側が `outputName` と同様に `.mp4` を
 * 付けて使う。
 */
export const previewName = (name: string): string => `${name}.preview`;

/**
 * 入力ファイルが Studio 用プロキシ (`<basename>.preview.mp4`) かどうかを、
 * basename が `.preview.mp4` で終わるかで判定する。README の後付け手順
 * (`npm run convert -- <slug> public/projects/<slug>/*.mp4`) の glob は
 * 生成済みのプロキシも拾ってしまうため、runConvert 側でこれを使って
 * スキップする (`<name>.preview.preview.mp4` の生成を防ぐ)。
 */
export const isPreviewInput = (inFile: string): boolean =>
  path.basename(inFile).endsWith(".preview.mp4");

/** 変換 1 本分の ffmpeg 引数を組み立てる。encoder ごとに異なるオプションを使う。 */
export const encodeArgs = (o: {
  /** 使うエンコーダ。 */
  encoder: Encoder;
  /** 入力ファイルパス。 */
  input: string;
  /** 出力ファイルパス。 */
  output: string;
  /** 出力の fps。 */
  fps: number;
  /** GOP 長 (キーフレーム間隔)。 */
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

/**
 * Studio 用プロキシ (ADR-0013) 1 本分の ffmpeg 引数を組み立てる。変換済み
 * 素材 (input) から縮小するだけなので `-hwaccel cuda` は付けない (scale は
 * CPU フィルタで、1080p H.264 のデコードは CPU で十分速い)。音声は
 * 再エンコードせずコピーする。
 */
export const previewArgs = (o: {
  /** 使うエンコーダ。 */
  encoder: Encoder;
  /** 入力ファイルパス (変換済み素材)。 */
  input: string;
  /** 出力ファイルパス。 */
  output: string;
  /** GOP 長 (キーフレーム間隔)。変換済み素材と同じ値を使う。 */
  gop: number;
  /** プロキシの高さ (`previewHeight` の戻り値)。 */
  height: number;
}): string[] => {
  const { encoder, input, output, gop, height } = o;

  if (encoder === "nvenc") {
    return [
      "-y",
      "-i",
      input,
      "-vf",
      `scale=-2:${height}`,
      "-c:v",
      "h264_nvenc",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "p4",
      "-cq",
      "30",
      "-g",
      String(gop),
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      output,
    ];
  }

  return [
    "-y",
    "-i",
    input,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "30",
    "-g",
    String(gop),
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    output,
  ];
};

/** runConvert() が使う I/O・ffmpeg 呼び出しの差し替え口。 */
export type ConvertDeps = {
  /** ffmpeg の実行。exit code を返す。 */
  ffmpeg: (args: string[], env: NodeJS.ProcessEnv) => Promise<number>;
  /** パスの存在確認。 */
  exists: (p: string) => boolean;
  /** ディレクトリの作成。 */
  mkdir: (dir: string) => void;
  /** ファイルのリネーム (tmp から本番パスへの確定に使う)。 */
  rename: (from: string, to: string) => void;
  /** ファイルの削除 (失敗・中断時の tmp 掃除に使う)。 */
  unlink: (p: string) => void;
  /** 進捗ログの出力。 */
  log: (line: string) => void;
  /** 警告ログの出力。 */
  warn: (line: string) => void;
  /** ffmpeg に渡す環境変数の元。 */
  env: NodeJS.ProcessEnv;
  /**
   * 変換途中で失敗・中断した場合に不完全な出力ファイルが残らないよう、現在の
   * 一時ファイルパスを呼び出し側に伝える (シグナル受信時の削除に使う)。
   */
  onTmp: (p: string | null) => void;
};

/**
 * シグナルによる中断を呼び出し側 (convert-movie.ts) に伝えるための専用エラー。
 * 通常の失敗 (Error) と区別できるよう、main 側でメッセージを出し分ける。
 */
export class ConvertAbortedError extends Error {
  constructor() {
    super("中断されました");
    this.name = "ConvertAbortedError";
  }
}

/**
 * 各入力を <outDir>/<basename>.mp4 へ変換する (ADR-0003)。あわせて、その
 * 変換済み素材から Studio 用プロキシ <outDir>/<basename>.preview.mp4
 * (既定 540p、`PREVIEW_HEIGHT` で変更可) を作る (ADR-0013)。nvenc が使える
 * かを起動時にプローブし、以降の変換はプローブ結果の encoder で統一する。
 * nvenc が使える場合でも、あるファイルの変換に失敗したときはそのファイル
 * だけ libx264 で再試行し、以降のファイル・プロキシも libx264 に切り替える。
 * signal が中断されたら、nvenc → libx264 の再試行はせず ConvertAbortedError
 * を投げる。
 */
export const runConvert = async (
  o: {
    /** 入力ファイルパスの列。 */
    inputs: string[];
    /** 出力先ディレクトリ。 */
    outDir: string;
    /** 出力の fps。 */
    fps: number;
    /** GOP 長 (キーフレーム間隔)。 */
    gop: number;
    /** 中断シグナル。abort されたら ConvertAbortedError を投げる。 */
    signal?: AbortSignal;
  },
  deps: ConvertDeps,
): Promise<void> => {
  const { inputs, outDir, fps, gop, signal } = o;

  // ffmpeg を 1 本も起動する前に検証する (不正な値なら probe より前に失敗させる)。
  const height = previewHeight(deps.env);
  deps.log(`preview: 高さ ${height}px`);

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

  const envFor = (e: Encoder): NodeJS.ProcessEnv =>
    e === "nvenc" ? nvencEnv(deps.env) : deps.env;

  // 1 本のエンコードを tmp へ書いて target へ rename するまでの共通処理。
  // nvenc が失敗したら libx264 で再試行し、以降 (このファイルのプロキシ・
  // 次のファイル) の encoder も libx264 に固定する (呼び出し元の `encoder`
  // を書き換える)。tmp の掃除・onTmp の通知・abort の検知は main の出力・
  // プロキシの出力で共通のため、ここへ集約する。
  const encodeToFile = async (p: {
    tmp: string;
    target: string;
    /** ログ・エラーメッセージに出す対象の名前 (入力ファイルまたは出力先)。 */
    label: string;
    buildArgs: (e: Encoder) => string[];
  }): Promise<Encoder> => {
    deps.onTmp(p.tmp);
    let usedEncoder: Encoder = encoder;

    try {
      if (encoder === "nvenc") {
        const code = await deps.ffmpeg(p.buildArgs("nvenc"), envFor("nvenc"));

        if (signal?.aborted) {
          throw new ConvertAbortedError();
        }

        if (code !== 0) {
          deps.warn(
            `warn: nvenc に失敗したため libx264 で再試行します: ${p.label}`,
          );

          const retryCode = await deps.ffmpeg(
            p.buildArgs("libx264"),
            envFor("libx264"),
          );

          if (signal?.aborted) {
            throw new ConvertAbortedError();
          }

          if (retryCode !== 0) {
            throw new Error(
              `ffmpeg が失敗しました (exit ${retryCode}): ${p.label}`,
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
          p.buildArgs("libx264"),
          envFor("libx264"),
        );

        if (signal?.aborted) {
          throw new ConvertAbortedError();
        }

        if (code !== 0) {
          throw new Error(`ffmpeg が失敗しました (exit ${code}): ${p.label}`);
        }
      }
    } catch (error) {
      deps.unlink(p.tmp);
      deps.onTmp(null);
      throw error;
    }

    try {
      deps.rename(p.tmp, p.target);
    } catch (error) {
      deps.unlink(p.tmp);
      deps.onTmp(null);
      throw error;
    }

    deps.onTmp(null);
    return usedEncoder;
  };

  for (const inFile of inputs) {
    if (signal?.aborted) {
      throw new ConvertAbortedError();
    }

    if (isPreviewInput(inFile)) {
      deps.log(`skip: ${inFile} はプロキシです`);
      continue;
    }

    const name = outputName(inFile);
    const output = path.join(outDir, `${name}.mp4`);

    if (deps.exists(output)) {
      deps.log(`skip: ${output} は既に存在します`);
    } else {
      // 拡張子が .tmp のままだと ffmpeg が出力 muxer を推定できず失敗するため、
      // 拡張子は .mp4 のまま隠しファイル名で一時出力する。
      const tmp = path.join(outDir, `.tmp.${name}.mp4`);

      deps.log(`encode: ${inFile} -> ${output} (${encoder}, fps=${fps})`);

      const usedEncoder = await encodeToFile({
        tmp,
        target: output,
        label: inFile,
        buildArgs: (e) =>
          encodeArgs({ encoder: e, input: inFile, output: tmp, fps, gop }),
      });

      deps.log(`done: ${output} (${usedEncoder})`);
    }

    if (signal?.aborted) {
      throw new ConvertAbortedError();
    }

    // プロキシは変換済み素材 (output) から作る。原本 (inFile) からは作らない
    // (ADR-0013): 原本は変換時の読み取り 1 回だけに留める。
    const previewOutput = path.join(outDir, `${previewName(name)}.mp4`);

    if (deps.exists(previewOutput)) {
      deps.log(`skip: ${previewOutput} は既に存在します`);
      continue;
    }

    const previewTmp = path.join(outDir, `.tmp.${name}.preview.mp4`);

    deps.log(`encode: ${output} -> ${previewOutput} (${encoder}, preview)`);

    const usedPreviewEncoder = await encodeToFile({
      tmp: previewTmp,
      target: previewOutput,
      label: output,
      buildArgs: (e) =>
        previewArgs({
          encoder: e,
          input: output,
          output: previewTmp,
          gop,
          height,
        }),
    });

    deps.log(`done: ${previewOutput} (${usedPreviewEncoder}, preview)`);
  }
};
