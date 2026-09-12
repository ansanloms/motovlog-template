// .aup2 のオブジェクト群を timeline.ts の中間表現に写す純粋関数 (#5)。
//
// 写像の規則はこのファイルのコメントと scripts/migrate/README.md に書く。
// 位置とフェードの秒数はすべてここで確定し (小数第 3 位で丸める)、emit.ts は
// 文字列にするだけにする。AviUtl の frame は両端を含む区間で、fps で割ると
// 秒になる (`at = start / fps`、`duration = (end - start + 1) / fps`)。
//
// 原本には OP (サムネ) が無いため、すべての要素を OP の尺だけ後ろへ送る
// (shift)。章タイトルも原本には無く、下部の帯 (図形) 6 本が章の区切りを
// 暗示しているため、各帯の開始に終わりが合うように章タイトルを置く。

import { outputName } from "../../convert/plan.ts";
import type { Aup2, Aup2Object } from "./parse.ts";
import { findFilter, numberParam } from "./parse.ts";

/** 音量 (一定値、または item の再生開始からの秒を at に持つ折れ線)。 */
export type VolumePlan =
  number | readonly { readonly at: number; readonly volume: number }[];

/** 走行映像 1 本。 */
export type VideoPlan = {
  /** timeline.ts 内で付ける変数名 (ED のアンカーに使う)。 */
  readonly ref: string;
  /** public/projects/<slug>/ からの相対パス。 */
  readonly src: string;
  /** 元動画の頭を捨てる秒数。 */
  readonly trimBefore: number;
  readonly volume: VolumePlan;
  /** 直前から crossfade で繋ぐ場合はその尺 (秒)。この場合 at は書かない。 */
  readonly crossfadeIn?: number;
  readonly at: number;
  readonly duration: number;
  readonly in: number;
  readonly out: number;
};

/** BGM 1 区間。 */
export type AudioPlan = {
  /** public/ からの相対パス。 */
  readonly src: string;
  readonly trimBefore: number;
  readonly volume: VolumePlan;
  readonly at: number;
  readonly duration: number;
};

/** ED に出す走行の記録。 */
export type EndingPlan = {
  readonly title: string;
  readonly subtitle: string;
  readonly date: { readonly from: string; readonly to: string };
  readonly distance: number;
  readonly ridingTime: { readonly hours: number; readonly minutes: number };
  readonly routes: readonly string[];
  readonly credits: readonly Readonly<Record<string, string>>[];
};

/** 写真紹介の枠に置く 1 要素 (写真の URL、または短い動画)。 */
export type PhotoElementPlan =
  | string
  | {
      /** public/projects/<slug>/ からの相対パス。 */
      readonly video: string;
      readonly trimBefore: number;
      readonly volume: VolumePlan;
    };

/** OP・章タイトル・写真紹介・ED を 1 本の layer に並べたもの。 */
export type ScenePlan =
  | {
      readonly kind: "opening";
      readonly at: number;
      /** public/projects/<slug>/ からの相対パス。 */
      readonly photo: string;
      readonly badge: string;
      readonly title: string;
    }
  | {
      readonly kind: "chapter";
      readonly at: number;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly kind: "photo";
      readonly at: number;
      readonly duration: number;
      readonly photos: readonly PhotoElementPlan[];
    }
  | {
      readonly kind: "ending";
      /** 終端を合わせる走行映像の変数名。 */
      readonly anchor: string;
      readonly ending: EndingPlan;
    };

/** 立ち絵 1 区間。 */
export type FigurePlan = {
  readonly at: number;
  readonly duration: number;
  readonly in: number;
  readonly out: number;
  readonly expression: string;
  readonly side: "left" | "right";
};

/** 下の layer の合成結果に掛けるフェード 1 区間 (frame())。 */
export type FramePlan = {
  readonly at: number;
  readonly duration: number;
  readonly in: number;
  readonly out: number;
  /** OP の黒からの立ち上がり (theme の openingTiming を使って書く)。 */
  readonly opening?: boolean;
};

/**
 * 発話 layer に並べるもの。位置は `at` (絶対秒) か `after` (直前の発話が
 * 実際に終わってからの間隔) のどちらか一方を持つ。
 */
export type NarrationPlan =
  | {
      readonly kind: "line";
      readonly at?: number;
      readonly after?: number;
      readonly text: string;
      readonly expression?: string;
    }
  | {
      readonly kind: "subtitle";
      readonly at?: number;
      readonly after?: number;
      readonly duration: number;
      readonly text: string;
    };

/** 写さなかったオブジェクト 1 件。 */
export type SkippedPlan = {
  readonly id: number;
  readonly layer: number;
  readonly reason: string;
};

/** timeline.ts 1 本分の中間表現。 */
export type TimelinePlan = {
  readonly slug: string;
  /** 立ち絵として使うキャラクター定義のファイル名 (characters/<name>.ts の <name>)。 */
  readonly character: string;
  readonly videos: readonly VideoPlan[];
  readonly scenes: readonly ScenePlan[];
  readonly figures: readonly FigurePlan[];
  readonly audios: readonly AudioPlan[];
  readonly frames: readonly FramePlan[];
  readonly narration: readonly NarrationPlan[];
  readonly skipped: readonly SkippedPlan[];
  /** 人が埋めるべき値が空だった等の警告 (main.ts が標準エラーに出す)。 */
  readonly warnings: readonly string[];
};

/** jododaira.json 等、project ごとに人が埋める値。 */
export type ProjectMeta = {
  readonly title: string;
  readonly subtitle: string;
  /** Temporal.ZonedDateTime.from() に渡せる文字列。 */
  readonly date: { readonly from: string; readonly to: string };
  /** 走行距離 (km)。 */
  readonly distance: number;
  readonly ridingTime: { readonly hours: number; readonly minutes: number };
  readonly routes: readonly string[];
  /** 章タイトル (帯の本数と同じ数だけ要る)。 */
  readonly chapters: readonly {
    readonly title: string;
    readonly subtitle: string;
  }[];
  /** OP (サムネ) に使う写真の basename と右上のバッジ。 */
  readonly thumbnail: { readonly photo: string; readonly badge: string };
};

/** theme から渡す秒数 (plan.ts は src/ を import しない)。 */
export type MigrateTiming = {
  readonly fps: number;
  /** OP の尺。原本の全要素をこの秒数だけ後ろへ送る。 */
  readonly openingDurationSec: number;
  /** OP の黒からの立ち上がり。 */
  readonly openingFadeInSec: number;
  /** 章タイトルの表示尺。 */
  readonly chapterDurationSec: number;
  /** ED の尺。 */
  readonly endingDurationSec: number;
  /**
   * 発話の位置を絶対秒に戻す無音の閾値 (theme の bandTiming.silenceGap)。
   * これ未満の無音で繋がる発話は `after` で相対に置く。
   */
  readonly narrationRunGapSec: number;
};

/** planTimeline() に渡す設定。 */
export type MigrateConfig = {
  readonly slug: string;
  readonly character: string;
  readonly project: ProjectMeta;
  /** PSDToolKit の `レイヤー` 文字列 → 表情名。値が空なら normal に落とす。 */
  readonly expressions: Readonly<Record<string, string>>;
  readonly timing: MigrateTiming;
};

/** 表情名が未割り当てのときの既定値。 */
const DEFAULT_EXPRESSION = "normal";

/** OP と章タイトル 1 本目の間隔 (秒)。サンプル timeline と同じ。 */
const OPENING_GAP_SEC = 0.2;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Windows のパスから basename を取り出す。 */
const baseName = (windowsPath: string): string => {
  const parts = windowsPath.split(/[\\/]/);

  return parts[parts.length - 1] ?? "";
};

/**
 * 動画ファイルの Windows パスを、変換後の出力名 (拡張子を落として .mp4 を
 * 付けたもの) にする。拡張子を落とす規則は scripts/convert/plan.ts の
 * outputName() と同じものを再利用する (basename だけを渡すため、
 * path.basename() が POSIX 実装でも区切り文字の扱いは問題にならない)。
 */
const videoFileName = (windowsPath: string): string =>
  `${outputName(baseName(windowsPath))}.mp4`;

/**
 * `再生位置=開始,終了,再生範囲,0` の開始秒を返す。`再生位置` が無ければ throw
 * する。理由: 0 に落とすと元動画の頭から使う timeline.ts を黙って書き出すため、
 * 原本と映像がずれても誰も気付かない。
 */
const trimBeforeOf = (
  filter: { params: Record<string, string> },
  objectId: number,
): number => {
  const raw = filter.params["再生位置"];

  if (raw === undefined) {
    throw new Error(
      `aup2: [${objectId}] に 再生位置 がありません (元動画のどこから使うか決まりません)`,
    );
  }

  const rawStart = raw.split(",")[0].trim();
  const start = Number(rawStart);

  if (rawStart === "" || !Number.isFinite(start)) {
    throw new Error(
      `aup2: [${objectId}] の 再生位置 の開始が数値ではありません: ${raw}`,
    );
  }

  return start;
};

/**
 * AviUtl の `音量` (百分率) と `音量フェード` を volume (一定値または折れ線)
 * に写す。イン・アウトがどちらも 0 なら一定値、そうでなければ 0 から立ち
 * 上げて 0 へ落とす折れ線にする。
 */
export const volumePlan = (o: {
  readonly level: number;
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly duration: number;
}): VolumePlan => {
  const level = round3(clamp01(o.level / 100));
  const duration = round3(o.duration);
  // 丸めて 0 になるフェードは無いものとして扱う (折れ線の at は狭義単調
  // 増加でなければ assertVolume が throw するため)。
  const fadeIn = round3(Math.max(0, o.fadeIn));
  const fadeOut = round3(Math.max(0, o.fadeOut));

  if (fadeIn <= 0 && fadeOut <= 0) {
    return level;
  }

  if (fadeIn + fadeOut > duration) {
    throw new Error(
      `音量フェード のイン (${fadeIn}) とアウト (${fadeOut}) の合計が尺 (${duration}) を超えています`,
    );
  }

  const peakStart = fadeIn;
  const peakEnd = fadeOut > 0 ? round3(duration - fadeOut) : duration;

  const points = [
    ...(fadeIn > 0 ? [{ at: 0, volume: 0 }] : []),
    { at: peakStart, volume: level },
    // イン + アウトが尺と等しいとき、立ち上がりの頂点と落ち始めが重なる。
    // 同じ at の点は置けないので 1 点に畳んで三角形にする。
    ...(peakEnd > peakStart ? [{ at: peakEnd, volume: level }] : []),
    ...(fadeOut > 0 ? [{ at: duration, volume: 0 }] : []),
  ];

  points.forEach((point, index) => {
    if (index > 0 && point.at <= points[index - 1].at) {
      throw new Error(
        `音量フェード の折れ線の at が単調増加になりません (${points[index - 1].at} -> ${point.at})`,
      );
    }
  });

  return points;
};

/** 立ち絵の左右を `標準描画` の X の符号で決める。 */
const sideOf = (object: Aup2Object): "left" | "right" =>
  numberParam(findFilter(object, "標準描画"), "X", 0) < 0 ? "left" : "right";

/**
 * ED のクレジット (`テキスト` の 1 オブジェクト) を `{ ラベル: 値 }` の列に
 * 写す。AviUtl の文字サイズ指定 (`<s32>` 等) を落とし、`\n` で行に割り、
 * 「ラベル: 値」の形の行だけを拾う (URL だけの行は落とす)。
 */
export const parseCredits = (
  text: string,
): readonly Readonly<Record<string, string>>[] =>
  text
    .replace(/\\n/g, "\n")
    .replace(/<s\d+>/g, "")
    .split("\n")
    .map((rawLine) => rawLine.trim())
    .filter((rawLine) => rawLine !== "" && !/^https?:/.test(rawLine))
    .flatMap((rawLine) => {
      // 半角コロンは後ろに空白を要求する (URL や時刻を誤って割らないため)。
      // 全角コロンは空白が無くてもラベルの区切りとして扱う。
      const matched = /^(.+?)(?::[ \t]+|：[ \t]*)(.+)$/.exec(rawLine);

      if (matched === null) {
        return [];
      }

      return [{ [matched[1].trim()]: matched[2].trim() }];
    });

/** layer と先頭フィルタ名でオブジェクトを絞り、frame 順に並べる。 */
const pick = (
  objects: readonly Aup2Object[],
  predicate: (object: Aup2Object) => boolean,
): Aup2Object[] =>
  objects.filter(predicate).sort((a, b) => a.frame[0] - b.frame[0]);

/** オブジェクトの先頭フィルタ名。 */
const kindOf = (object: Aup2Object): string => object.filters[0]?.name ?? "";

/**
 * 同じ layer に置く item の時間順・非重複を検査する (timeline() が同じ検査を
 * フレーム単位で行うため、生成した時点で弾く)。crossfadeIn を持つ item は
 * 直前と遷移の尺だけ重なるのが正しいので、その分を差し引いて比較する。
 */
const assertOrdered = (
  label: string,
  items: readonly {
    readonly at: number;
    readonly duration: number;
    readonly crossfadeIn?: number;
  }[],
  fps: number,
): void => {
  let cursor = 0;

  items.forEach((item, index) => {
    const allowed = cursor - (item.crossfadeIn ?? 0);

    if (Math.round(item.at * fps) < Math.round(allowed * fps)) {
      throw new Error(
        `${label}: item ${index} (at ${item.at}) が直前の終端 (${allowed}) より前です`,
      );
    }

    cursor = item.at + item.duration;
  });
};

/**
 * .aup2 のオブジェクト群を timeline.ts の中間表現に写す。
 *
 * - layer 1 の `動画ファイル` → 走行映像。`再生位置` の開始秒を trimBefore、
 *   `フェード` を fade の in/out、`映像再生` の `音量` と `音量フェード` を
 *   volume の折れ線にする。
 * - 走行映像の切れ目に掛かる `シーンチェンジ` (クロスフェード) → crossfade。
 *   直前の映像の尺を遷移の尺だけ延ばし、直後の映像の絶対開始を動かさない。
 * - layer 2 の `音声ファイル` → BGM。
 * - `画像ファイル`・`動画ファイル` (走行映像の layer を除く) → 写真紹介
 *   1 要素ずつ。動画は `再生位置` の開始秒を trimBefore、`映像再生` の
 *   `音量` を volume (既定 0) にする。
 * - `PSDファイル@PSDToolKit` → 立ち絵。`標準描画` の X の符号で左右を決め、
 *   `レイヤー` 文字列を config.expressions で表情名に引く。
 * - `フレームバッファ`・`シーンチェンジ` (暗転) → frame() のフェード。
 * - 音声 (`音声ファイル`) と字幕 (`テキスト`) を開始フレームで対応させて発話に
 *   する。声の無い字幕は duration を明示した item にし、ED の区間にある
 *   ものはクレジットとして ED に回す。
 * - `図形` の帯 → 章の区切り。各章の先頭に章タイトルを置く。
 *
 * 走行映像の最後のフレームより後ろから始まるオブジェクトは写さない
 * (原本の ED の静止画とその上の立ち絵・暗転)。途中から末尾がはみ出る
 * オブジェクトは走行映像の終端で切る。
 */
export const planTimeline = (
  aup2: Aup2,
  config: MigrateConfig,
): TimelinePlan => {
  const { fps } = config.timing;
  const shift = config.timing.openingDurationSec;
  const warnings: string[] = [];
  const skipped: SkippedPlan[] = [];
  const { objects } = aup2;

  // 走行映像は 動画ファイル が置かれた layer のうち最も下のもの
  // (写真紹介の枠に置かれた動画と区別するため)。
  const movieObjects = objects.filter((o) => kindOf(o) === "動画ファイル");

  if (movieObjects.length === 0) {
    throw new Error("aup2: 走行映像 (動画ファイル) がありません");
  }

  const videoLayer = Math.min(...movieObjects.map((o) => o.layer));
  const videoObjects = pick(movieObjects, (o) => o.layer === videoLayer);
  const endFrame = videoObjects[videoObjects.length - 1].frame[1];

  const atOf = (frame: number): number => round3(frame / fps + shift);

  /**
   * オブジェクトの尺 (秒)。走行映像の終端 (endFrame) より後ろへはみ出す分は
   * 切り詰める。object を渡すと、詰めた後の尺にフェード (`フェード`・
   * `音量フェード` の `イン` + `アウト`) が収まるかを確かめ、収まらなければ
   * throw する。理由: 収まらないまま通すと、原本より早く閉じるフェードを黙って
   * 書き出すか、どこで詰めたのか分からないまま下流 (fade() の
   * `in + out > duration`、volumePlan()) が落ちる。
   */
  const durationOf = (
    range: readonly [number, number],
    object?: Aup2Object,
  ): number => {
    const duration = round3(
      (Math.min(range[1], endFrame) - range[0] + 1) / fps,
    );

    if (object === undefined || range[1] <= endFrame) {
      return duration;
    }

    for (const name of ["フェード", "音量フェード"] as const) {
      const filter = findFilter(object, name);
      const fadeIn = round3(numberParam(filter, "イン", 0));
      const fadeOut = round3(numberParam(filter, "アウト", 0));

      if (round3(fadeIn + fadeOut) > duration) {
        throw new Error(
          `aup2: [${object.id}] の終端を走行映像の終端に詰めた (frame ${range[1]} -> ${endFrame}、尺 ${duration} 秒) ため、${name} のイン (${fadeIn} 秒) + アウト (${fadeOut} 秒) が収まりません`,
        );
      }
    }

    return duration;
  };

  /** 走行映像の終端より後ろから始まるオブジェクトを落とす。 */
  const withinTimeline = (object: Aup2Object): boolean => {
    if (object.frame[0] <= endFrame) {
      return true;
    }

    skipped.push({
      id: object.id,
      layer: object.layer,
      reason: `走行映像の終端 (frame ${endFrame}) より後ろから始まる`,
    });

    return false;
  };

  // シーンチェンジ (クロスフェード) を走行映像の切れ目に対応付ける。
  // DSL は crossfade の直後の item の開始を「直前の item の終端 - 遷移の尺」に
  // 固定するため、直前の item の尺を遷移の尺だけ延ばして直後の絶対開始を保つ。
  // 遷移の尺は「直前の item を延ばす秒数」と「直後の item の crossfadeIn」の
  // 両方に効くので、走行映像を組み立てる前に求めておく。
  const crossfades = new Map<number, number>();

  for (const object of objects) {
    const scene = findFilter(object, "シーンチェンジ");

    if (!scene || scene.params["種類"] !== "クロスフェード") {
      continue;
    }

    const boundary = videoObjects.findIndex(
      (video, index) =>
        index + 1 < videoObjects.length &&
        video.frame[1] >= object.frame[0] &&
        video.frame[1] <= object.frame[1],
    );

    if (boundary === -1) {
      skipped.push({
        id: object.id,
        layer: object.layer,
        reason: "走行映像の切れ目に掛からない シーンチェンジ (クロスフェード)",
      });
      continue;
    }

    if (
      videoObjects[boundary + 1].frame[0] !==
      videoObjects[boundary].frame[1] + 1
    ) {
      throw new Error(
        `aup2: [${object.id}] のクロスフェードの前後の走行映像が連続していません`,
      );
    }

    if (
      numberParam(findFilter(videoObjects[boundary], "フェード"), "アウト", 0) >
      0
    ) {
      throw new Error(
        `aup2: [${object.id}] のクロスフェードの直前の走行映像にフェードアウトが掛かっています`,
      );
    }

    crossfades.set(
      boundary + 1,
      round3((object.frame[1] - object.frame[0] + 1) / fps),
    );
  }

  // 走行映像。
  const videos: VideoPlan[] = videoObjects.map((object, index) => {
    const file = object.filters[0];
    const fade = findFilter(object, "フェード");
    const play = findFilter(object, "映像再生");
    const volumeFade = findFilter(object, "音量フェード");
    const crossfadeOut = crossfades.get(index + 1) ?? 0;
    const crossfadeIn = crossfades.get(index);
    const duration = round3(durationOf(object.frame, object) + crossfadeOut);

    return {
      ref: `clip${index + 1}`,
      src: videoFileName(file.params["ファイル"] ?? ""),
      trimBefore: round3(trimBeforeOf(file, object.id)),
      volume: volumePlan({
        level: numberParam(play, "音量", 100),
        fadeIn: numberParam(volumeFade, "イン", 0),
        fadeOut: numberParam(volumeFade, "アウト", 0),
        duration,
      }),
      ...(crossfadeIn !== undefined ? { crossfadeIn } : {}),
      at: atOf(object.frame[0]),
      duration,
      in: round3(numberParam(fade, "イン", 0)),
      out: round3(numberParam(fade, "アウト", 0)),
    };
  });

  videos.forEach((video, index) => {
    if (video.crossfadeIn === undefined) {
      return;
    }

    const previous = videos[index - 1];
    const implied = round3(previous.at + previous.duration - video.crossfadeIn);

    if (Math.round(implied * fps) !== Math.round(video.at * fps)) {
      throw new Error(
        `crossfade: ${video.ref} の開始が動きます (${video.at} -> ${implied})`,
      );
    }
  });

  // 音声ファイル をセリフの音声と BGM に分ける。セリフの音声は字幕
  // (同じ開始フレームの テキスト) か PSDToolKit の配線 (同じ group の
  // セリフ準備) と組になっている。どちらも無いものを BGM とする。layer の
  // 位置では判定しない (BGM の無い project では最も下の 音声ファイル が
  // セリフの音声になるため)。
  const soundObjects = objects.filter((o) => kindOf(o) === "音声ファイル");
  const allTexts = pick(objects, (o) => kindOf(o) === "テキスト");
  const textStartFrames = new Set(allTexts.map((o) => o.frame[0]));
  const speechGroups = new Set(
    objects
      .filter((o) => kindOf(o) === "セリフ準備@PSDToolKit")
      .map((o) => o.group)
      .filter((group): group is number => group !== undefined),
  );

  const isVoiceObject = (object: Aup2Object): boolean =>
    textStartFrames.has(object.frame[0]) ||
    (object.group !== undefined && speechGroups.has(object.group));

  const audios: AudioPlan[] = pick(soundObjects, (o) => !isVoiceObject(o))
    .filter(withinTimeline)
    .map((object) => {
      const file = object.filters[0];
      const play = findFilter(object, "音声再生");
      const volumeFade = findFilter(object, "音量フェード");
      const duration = durationOf(object.frame, object);

      return {
        src: `assets/bgm/${baseName(file.params["ファイル"] ?? "")}`,
        trimBefore: round3(trimBeforeOf(file, object.id)),
        volume: volumePlan({
          level: numberParam(play, "音量", 100),
          fadeIn: numberParam(volumeFade, "イン", 0),
          fadeOut: numberParam(volumeFade, "アウト", 0),
          duration,
        }),
        at: atOf(object.frame[0]),
        duration,
      };
    });

  // 写真紹介 (走行映像の layer 以外の 画像ファイル・動画ファイル)。
  const photoElements = pick(
    objects,
    (o) =>
      (kindOf(o) === "画像ファイル" || kindOf(o) === "動画ファイル") &&
      o.layer !== videoLayer,
  ).filter(withinTimeline);

  /** 写真紹介の枠に置かれた 1 要素を写真の URL か動画要素にする。 */
  const photoElementOf = (object: Aup2Object): PhotoElementPlan => {
    const file = object.filters[0];

    if (kindOf(object) !== "動画ファイル") {
      return `photos/${baseName(file.params["ファイル"] ?? "")}`;
    }

    // 動画は走行映像と同じく scripts/convert-movie.ts で
    // public/projects/<slug>/ 直下に置く運用のため、photos/ を付けない。
    const play = findFilter(object, "映像再生");
    const volumeFade = findFilter(object, "音量フェード");
    const duration = durationOf(object.frame, object);

    return {
      video: videoFileName(file.params["ファイル"] ?? ""),
      trimBefore: round3(trimBeforeOf(file, object.id)),
      volume: volumePlan({
        level: numberParam(play, "音量", 100),
        fadeIn: numberParam(volumeFade, "イン", 0),
        fadeOut: numberParam(volumeFade, "アウト", 0),
        duration,
      }),
    };
  };

  for (const object of objects) {
    if (kindOf(object) === "画像ファイル" && object.layer === videoLayer) {
      skipped.push({
        id: object.id,
        layer: object.layer,
        reason: "走行映像の layer に置かれた静止画 (ED の背景)",
      });
    }
  }

  // 立ち絵。
  const missingExpressions = new Set<string>();
  const figures: FigurePlan[] = pick(
    objects,
    (o) => kindOf(o) === "PSDファイル@PSDToolKit",
  )
    .filter(withinTimeline)
    .map((object) => {
      const key = object.filters[0].params["レイヤー"] ?? "";
      const expression = config.expressions[key] ?? "";

      if (expression === "") {
        missingExpressions.add(key);
      }

      const fade = findFilter(object, "フェード");

      return {
        at: atOf(object.frame[0]),
        duration: durationOf(object.frame, object),
        in: round3(numberParam(fade, "イン", 0)),
        out: round3(numberParam(fade, "アウト", 0)),
        expression: expression === "" ? DEFAULT_EXPRESSION : expression,
        side: sideOf(object),
      };
    });

  for (const key of [...missingExpressions].sort()) {
    warnings.push(
      `立ち絵の表情が未割り当てです (${DEFAULT_EXPRESSION} に落とします): ${key}`,
    );
  }

  // frame() のフェード。OP の黒からの立ち上がりを先頭に足す。
  const frames: FramePlan[] = [
    {
      at: 0,
      duration: round3(config.timing.openingFadeInSec),
      in: round3(config.timing.openingFadeInSec),
      out: 0,
      opening: true,
    },
    ...pick(
      objects,
      (o) =>
        kindOf(o) === "フレームバッファ" ||
        (findFilter(o, "シーンチェンジ") !== undefined &&
          findFilter(o, "シーンチェンジ")?.params["種類"] === "暗転"),
    )
      .filter(withinTimeline)
      .map((object) => {
        const duration = durationOf(object.frame, object);

        if (kindOf(object) === "シーンチェンジ") {
          // 暗転は前半で黒へ落ちて後半で戻る。frame() のフェードでは
          // in / out を区間の半分ずつにする。fade() は in + out が duration を
          // 超えると throw するため、半分はフレームに切り下げて求める。
          const half = round3(Math.floor((duration / 2) * fps) / fps);

          return { at: atOf(object.frame[0]), duration, in: half, out: half };
        }

        const fade = findFilter(object, "フェード");

        return {
          at: atOf(object.frame[0]),
          duration,
          in: round3(numberParam(fade, "イン", 0)),
          out: round3(numberParam(fade, "アウト", 0)),
        };
      }),
  ];

  // 発話と字幕。音声と字幕は開始フレームで対応させる。
  const voices = pick(soundObjects, isVoiceObject).filter(withinTimeline);
  const texts = allTexts.filter(withinTimeline);
  // 同じ開始フレームに テキスト が複数あれば、先に現れたもの (番号の小さい
  // オブジェクト) を音声の字幕とし、残りは声の無い字幕として扱う。2 行の
  // 字幕を別オブジェクトに分けている project では対応を取り違えるため、
  // 警告を出して人が確認できるようにする。
  const textByFrame = new Map<number, Aup2Object>();

  for (const text of texts) {
    const prior = textByFrame.get(text.frame[0]);

    if (prior === undefined) {
      textByFrame.set(text.frame[0], text);
      continue;
    }

    warnings.push(
      `同じ開始フレーム (${text.frame[0]}) の テキスト が複数あります ([${prior.id}] を字幕にし、[${text.id}] は声の無い字幕として置きます)`,
    );
  }

  const usedTexts = new Set<number>();

  const lastVideo = videos[videos.length - 1];
  const endingFromSec = round3(
    lastVideo.at + lastVideo.duration - config.timing.endingDurationSec,
  );

  /** 位置を決める前の発話 (原本のフレーム範囲を保ったまま並べる)。 */
  type NarrationDraft = {
    readonly kind: NarrationPlan["kind"];
    readonly frame: readonly [number, number];
    readonly text: string;
  };

  const drafts: NarrationDraft[] = voices.map((object) => {
    const text = textByFrame.get(object.frame[0]);

    if (text === undefined) {
      throw new Error(
        `aup2: [${object.id}] の音声に対応する字幕 (同じ開始フレームの テキスト) がありません`,
      );
    }

    usedTexts.add(text.id);

    return {
      kind: "line" as const,
      frame: object.frame,
      // AviUtl の字幕は配置の都合で前後に空白が入ることがある。読みも
      // 字幕の見た目も変わらないため落とす。
      text: (text.filters[0].params["テキスト"] ?? "").trim(),
    };
  });

  let credits: readonly Readonly<Record<string, string>>[] = [];

  for (const text of texts) {
    if (usedTexts.has(text.id)) {
      continue;
    }

    const body = (text.filters[0].params["テキスト"] ?? "").trim();

    if (atOf(text.frame[0]) >= endingFromSec) {
      // ED の区間に置かれた声の無い字幕はクレジット (複数あれば繋ぐ)。
      credits = [...credits, ...parseCredits(body)];
      skipped.push({
        id: text.id,
        layer: text.layer,
        reason: "ED のクレジット (ending() の credits に写す)",
      });
      continue;
    }

    drafts.push({ kind: "subtitle", frame: text.frame, text: body });
  }

  drafts.sort((a, b) => a.frame[0] - b.frame[0]);

  // 発話の expression は、その時刻に出ている立ち絵の表情に合わせる
  // (前の発話から変わるときだけ書く)。
  const figureAt = (at: number): FigurePlan | undefined =>
    figures.find(
      (figure) => figure.at <= at && at < figure.at + figure.duration,
    );

  // 発話の位置は、無音が短く続く間 (silenceGap 未満) は `after` (直前の
  // 発話が実際に終わってからの間隔) で繋ぎ、無音が silenceGap 以上あいたら
  // 絶対秒 (`at`) に戻す。理由: 音声は VOICEVOX で作り直すため原本の wav と
  // 尺が一致せず、全部を絶対秒で置くと発話どうしが重なって timeline() が
  // throw する。原本が持っている情報のうち writer の意図が乗っているのは
  // 「間の取り方」なので、連続する発話の間はそれを保つ。silenceGap は暗がり
  // (字幕の帯) をひと続きと見なす閾値と同じで、1 続きの帯に乗る発話が
  // 1 つの run になる。
  let previousExpression: string | undefined;
  let previousEnd: number | undefined;

  const narration: NarrationPlan[] = drafts.map((draft) => {
    const at = atOf(draft.frame[0]);
    const gap =
      previousEnd === undefined
        ? Number.POSITIVE_INFINITY
        : round3(Math.max(0, at - previousEnd));

    previousEnd = round3(at + durationOf(draft.frame));

    const placement =
      gap >= config.timing.narrationRunGapSec ? { at } : { after: gap };

    if (draft.kind === "subtitle") {
      return {
        kind: "subtitle",
        ...placement,
        duration: durationOf(draft.frame),
        text: draft.text,
      };
    }

    const expression = figureAt(at)?.expression;
    const changed =
      expression !== undefined && expression !== previousExpression;

    if (changed) {
      previousExpression = expression;
    }

    return {
      kind: "line",
      ...placement,
      text: draft.text,
      ...(changed ? { expression } : {}),
    };
  });

  // 章。下部の帯 (図形) の開始で区切り、章タイトルはその開始に終わりを
  // 合わせて置く (OP の直後より前には出さない)。
  const bands = pick(objects, (o) => kindOf(o) === "図形").filter(
    withinTimeline,
  );

  if (bands.length !== config.project.chapters.length) {
    warnings.push(
      `章の数が合いません (帯 ${bands.length} 本、jododaira.json の chapters ${config.project.chapters.length} 件)`,
    );
  }

  const chapterFloor = round3(
    config.timing.openingDurationSec + OPENING_GAP_SEC,
  );

  const scenes: ScenePlan[] = [
    {
      kind: "opening",
      at: 0,
      photo: `photos/${config.project.thumbnail.photo}`,
      badge: config.project.thumbnail.badge,
      title: config.project.title,
    },
    ...bands.map((band, index) => {
      const chapter = config.project.chapters[index] ?? {
        title: "",
        subtitle: "",
      };

      return {
        kind: "chapter" as const,
        at: round3(
          Math.max(
            chapterFloor,
            atOf(band.frame[0]) - config.timing.chapterDurationSec,
          ),
        ),
        title: chapter.title,
        subtitle: chapter.subtitle,
      };
    }),
    ...photoElements.map((object) => ({
      kind: "photo" as const,
      at: atOf(object.frame[0]),
      duration: durationOf(object.frame, object),
      photos: [photoElementOf(object)],
    })),
    {
      kind: "ending",
      anchor: lastVideo.ref,
      ending: {
        title: config.project.title,
        subtitle: config.project.subtitle,
        date: config.project.date,
        distance: config.project.distance,
        ridingTime: config.project.ridingTime,
        routes: config.project.routes,
        credits,
      },
    },
  ];

  /** scene の開始秒 (ED は走行映像の終端から逆算する)。 */
  const sceneAt = (scene: ScenePlan): number =>
    scene.kind === "ending" ? endingFromSec : scene.at;

  /** scene の尺 (OP・章タイトル・ED は theme の定数)。 */
  const sceneDuration = (scene: ScenePlan): number => {
    switch (scene.kind) {
      case "opening":
        return config.timing.openingDurationSec;
      case "chapter":
        return config.timing.chapterDurationSec;
      case "ending":
        return config.timing.endingDurationSec;
      default:
        return scene.duration;
    }
  };

  scenes.sort((a, b) => sceneAt(a) - sceneAt(b));

  const sceneSpans = scenes.map((scene) => ({
    at: sceneAt(scene),
    duration: sceneDuration(scene),
  }));

  assertOrdered("走行映像", videos, fps);
  assertOrdered("OP・章タイトル・写真紹介", sceneSpans, fps);
  assertOrdered("立ち絵", figures, fps);
  assertOrdered("BGM", audios, fps);
  assertOrdered("frame()", frames, fps);

  // 写さなかったオブジェクトを一覧に残す。
  const handled = new Set<string>([
    "動画ファイル",
    "音声ファイル",
    "画像ファイル",
    "PSDファイル@PSDToolKit",
    "フレームバッファ",
    "シーンチェンジ",
    "テキスト",
    "図形",
  ]);

  // PSDToolKit の配線用オブジェクト。立ち絵の口パクと表情は figure() が
  // narration() の speech から作るため、写さずに落とす。
  const ignored = new Map<string, string>([
    [
      "セリフ準備@PSDToolKit",
      "PSDToolKit の音声と立ち絵の配線 (figure() が narration() の speech から作る)",
    ],
    ["最初に置くやつ@PSDToolKit", "PSDToolKit のシーン初期化"],
  ]);

  for (const object of objects) {
    const kind = kindOf(object);
    const reason = ignored.get(kind);

    if (reason !== undefined) {
      skipped.push({ id: object.id, layer: object.layer, reason });
      continue;
    }

    if (!handled.has(kind)) {
      skipped.push({
        id: object.id,
        layer: object.layer,
        reason: `未対応のオブジェクト (${kind})`,
      });
    }
  }

  skipped.sort((a, b) => a.id - b.id);

  return {
    slug: config.slug,
    character: config.character,
    videos,
    scenes,
    figures,
    audios,
    frames,
    narration,
    skipped,
    warnings,
  };
};
