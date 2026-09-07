import { zColor } from "@remotion/zod-types";
import { z } from "zod";
import { displayText } from "./text";

// タイムライン定義のスキーマ。
//
// 時間はすべて秒単位 (number) で表す。フレーム換算は各コンポーネント側で
// `useVideoConfig()` の fps を使って行う。

const metaSchema = z.object({
  // h264 は偶数解像度が必要なため multipleOf(2) で拘束する。
  width: z.number().int().positive().multipleOf(2).default(1920),
  height: z.number().int().positive().multipleOf(2).default(1080),
  fps: z.number().positive().default(30),
});

const clipSchema = z.object({
  // public 相対のパス。動画固有の素材は projects/<slug>/…、共通素材は
  // assets/<種別>/… (ADR-0002)。
  src: z.string(),
  duration: z.number().positive(),
  // 元動画内の開始秒。
  sourceFrom: z.number().nonnegative().default(0),
  volume: z.number().min(0).max(1).default(1),
  // 直前クリップ終端からの空白秒。先頭クリップではタイムライン先頭からの空白。
  gapBefore: z.number().nonnegative().default(0),
  // 直前クリップとのオーバーラップ長 (秒)。0 ならクロスフェードなし。
  crossfadeIn: z.number().nonnegative().default(0),
});

// clips は絶対位置を持たない順序リストで、位置は gapBefore/crossfadeIn/duration
// から導出する (resolveClipSpans)。ここでは導出前の幾何的な整合だけを検証する。
const clipsSchema = z
  .array(clipSchema)
  .min(1)
  .superRefine((clips, ctx) => {
    clips.forEach((clip, index) => {
      if (index === 0 && clip.crossfadeIn !== 0) {
        ctx.addIssue({
          code: "custom",
          message: "先頭クリップの crossfadeIn は 0 にしてください",
          path: [index, "crossfadeIn"],
        });
      }

      if (clip.gapBefore > 0 && clip.crossfadeIn > 0) {
        ctx.addIssue({
          code: "custom",
          message: "gapBefore と crossfadeIn は同時に指定できません",
          path: [index, "crossfadeIn"],
        });
      }

      if (clip.crossfadeIn > clip.duration) {
        ctx.addIssue({
          code: "custom",
          message: "crossfadeIn は自身の duration 以下にしてください",
          path: [index, "crossfadeIn"],
        });
      }

      if (index > 0) {
        const prev = clips[index - 1];
        // 直前クリップは自身の crossfadeIn 分だけ露出前に隠れるため、
        // 次クリップが重ねてよいのはその露出長 (duration - crossfadeIn) まで。
        const prevExposedDuration = prev.duration - prev.crossfadeIn;

        if (clip.crossfadeIn > prevExposedDuration) {
          ctx.addIssue({
            code: "custom",
            message:
              "crossfadeIn は直前クリップの露出長 (duration - crossfadeIn) 以下にしてください",
            path: [index, "crossfadeIn"],
          });
        }
      }
    });
  });

const overlaySchema = z.object({
  kind: z.enum(["image", "video"]),
  src: z.string(),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  fadeIn: z.number().nonnegative().default(0.5),
  fadeOut: z.number().nonnegative().default(0.5),
  scale: z.number().default(1),
  // 画面中央原点のオフセット (px)。
  x: z.number().default(0),
  y: z.number().default(0),
  // kind: "video" のときのみ有効。既定は無音。差し込み素材の元音声は
  // 明示したときだけ鳴らす。
  volume: z.number().min(0).max(1).default(0),
  // kind: "video" のときのみ有効。元動画内の開始秒。
  sourceFrom: z.number().nonnegative().default(0),
});

// kind: "image" の要素は volume/sourceFrom を持たない (video のみ有効なフィールド
// のため)。default 値 (0) 以外が指定されていれば誤指定とみなす。
const overlaysSchema = z.array(overlaySchema).superRefine((overlays, ctx) => {
  overlays.forEach((overlay, index) => {
    if (overlay.kind !== "image") {
      return;
    }

    if (overlay.volume !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "image の overlay では volume は指定できません",
        path: [index, "volume"],
      });
    }

    if (overlay.sourceFrom !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "image の overlay では sourceFrom は指定できません",
        path: [index, "sourceFrom"],
      });
    }
  });
});

const bgmSchema = z.object({
  src: z.string(),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  sourceFrom: z.number().nonnegative().default(0),
  volume: z.number().min(0).max(1).default(1),
  fadeIn: z.number().nonnegative().default(1.2),
  fadeOut: z.number().nonnegative().default(1.0),
});

const lineSchema = z.object({
  // Sequence の key 等で参照されるため、英数字・_・- だけに絞る。
  id: z.string().regex(/^[A-Za-z0-9_-]+$/, "id は英数字・_・- だけ"),
  // 音声を生成するまで省略できる。npm run voice が書き戻す。
  audio: z.string().optional(),
  start: z.number().nonnegative(),
  // 音声を生成するまで省略できる。npm run voice が wav の実尺を書き戻す。
  duration: z.number().positive().optional(),
  // 字幕表示文。読みは {漢字|よみ} で書く (ADR-0006)。字幕には漢字側を、
  // 音声合成には読み側を使う (src/timeline/text.ts)。
  text: z.string().superRefine((text, ctx) => {
    // displayText 後に {・} が残っていれば、{漢字|よみ} の記法が閉じていない
    // (ネスト・書き忘れ等)。| は読み仮名の記法専用ではなく字幕の文字として
    // 使う場合がある (例: "60|80 km/h") ため対象外。
    if (/[{}]/.test(displayText(text))) {
      ctx.addIssue({
        code: "custom",
        message: "読み仮名の記法 {漢字|よみ} が閉じていません",
      });
    }
  }),
  // 話者 (VOICEVOX の style id)。省略時は timeline.voice.speaker を使う。
  speaker: z.number().int().nonnegative().optional(),
  // 口パクデータ (public 相対のパス)。音声を生成するまで省略できる。
  // npm run voice が書き戻す。
  lipsync: z.string().optional(),
  // 音声終了後に字幕を残す秒。
  subtitleTail: z.number().nonnegative().default(0.4),
});

// lines は id を key として参照される想定 (Sequence の key 等) のため、
// 重複があると描画・追跡が破綻する。
const linesSchema = z.array(lineSchema).superRefine((lines, ctx) => {
  const seen = new Map<string, number>();

  lines.forEach((line, index) => {
    const firstIndex = seen.get(line.id);

    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: `id が index ${firstIndex} と重複しています: ${line.id}`,
        path: [index, "id"],
      });
    } else {
      seen.set(line.id, index);
    }
  });

  // start 昇順に並べ、隣接する line 同士の区間 [start, start + duration) が
  // 重ならないことを検証する (Subtitles.tsx の clamp は隣接前提の保険であって
  // 重なりの許容ではない)。duration が無い line (音声未生成) は検証対象外。
  const sorted = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => entry.line.duration !== undefined)
    .sort((a, b) => a.line.start - b.line.start);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const prevDuration = prev.line.duration as number;

    if (next.line.start < prev.line.start + prevDuration) {
      ctx.addIssue({
        code: "custom",
        message: `start は直前の line (index ${prev.index}) の終了 (start + duration) 以降にしてください: ${next.line.id}`,
        path: [next.index, "start"],
      });
    }
  }
});

const subtitleBandSchema = z.object({
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  fadeIn: z.number().nonnegative().default(0.5),
  fadeOut: z.number().nonnegative().default(0.5),
});

const characterSegmentSchema = z.object({
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  // issue #3 で配線するまで、fadeIn/fadeOut は描画に使われない
  // (CharacterLayer は現状プレースホルダで、Sequence すら出さない)。
  fadeIn: z.number().nonnegative().default(0.4),
  fadeOut: z.number().nonnegative().default(0),
});

const endingSchema = z
  .object({
    fadeToBlackStart: z.number().nonnegative(),
    // 暗転フェードの長さ・秒。
    fadeDuration: z.number().positive().default(1.0),
    credits: z
      .object({
        text: z.string(),
        start: z.number().nonnegative(),
        duration: z.number().positive(),
      })
      .optional(),
  })
  .refine(
    (ending) =>
      !ending.credits || ending.credits.start >= ending.fadeToBlackStart,
    {
      message: "credits.start は fadeToBlackStart 以降にしてください",
      path: ["credits", "start"],
    },
  );

const subtitleStyleSchema = z.object({
  fontSize: z.number().default(40),
  color: zColor().default("#ffffff"),
  letterSpacing: z.number().default(2),
  // 画面下端からの px。
  bottomOffset: z.number().default(120),
  // 未指定なら縁取りは付けない。
  outline: z
    .object({
      color: zColor(),
      width: z.number(),
    })
    .optional(),
});

const bandStyleSchema = z.object({
  color: zColor().default("#262672"),
  opacity: z.number().min(0).max(1).default(0.8),
  height: z.number().default(160),
});

const styleSchema = z.object({
  // ZodObject.default() は出力型 (全フィールド確定後の型) を要求するため、
  // 全フィールドが独自に default を持つオブジェクトに対して .default({}) と
  // 書くと型エラーになる。.prefault() は入力型 (default 持ちフィールドは
  // 省略可) を要求するので、こちらを使う。
  subtitle: subtitleStyleSchema.prefault({}),
  band: bandStyleSchema.prefault({}),
});

export const timelineSchema = z.object({
  // ADR-0004: 互換性を切る変更で上げる。
  version: z.literal(1).default(1),
  meta: metaSchema.prefault({}),
  clips: clipsSchema,
  overlays: overlaysSchema.default([]),
  bgm: z.array(bgmSchema).default([]),
  // 既定の話者 (VOICEVOX の style id)。lines[].speaker が無いときに使う (ADR-0006)。
  voice: z.object({ speaker: z.number().int().nonnegative() }).optional(),
  lines: linesSchema.default([]),
  subtitleBands: z.array(subtitleBandSchema).default([]),
  characterSegments: z.array(characterSegmentSchema).default([]),
  ending: endingSchema.optional(),
  style: styleSchema.prefault({}),
});

export type Timeline = z.infer<typeof timelineSchema>;

// 音声・口パクデータを生成済みの line/timeline の型 (ADR-0006)。
// `npm run voice` が `lines[].audio`・`lines[].duration` を書き戻した後の状態を
// 型で保証し、計算・描画側 (Subtitles・VoiceLines・getTotalDurationInFrames 等)
// が duration を必須として扱えるようにする。
type Line = Timeline["lines"][number];

export type VoicedLine = Line & { audio: string; duration: number };

export type VoicedTimeline = Omit<Timeline, "lines"> & { lines: VoicedLine[] };

// audio か duration が未生成の line があれば拒否する。calculateMetadata から
// parse の直後に呼ぶ想定。
export const assertVoiced = (timeline: Timeline): VoicedTimeline => {
  const unvoiced = timeline.lines.filter(
    (line) => line.audio === undefined || line.duration === undefined,
  );

  if (unvoiced.length > 0) {
    throw new Error(
      `音声が未生成のセリフがあります: ${unvoiced.map((line) => line.id).join(", ")}。npm run voice -- <slug> を実行してください`,
    );
  }

  return timeline as VoicedTimeline;
};
