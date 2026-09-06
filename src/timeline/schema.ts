import { zColor } from "@remotion/zod-types";
import { z } from "zod";

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
  // public 相対のパス。
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
  id: z.string(),
  audio: z.string(),
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  // 字幕表示文。
  text: z.string(),
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
  meta: metaSchema.prefault({}),
  clips: clipsSchema,
  overlays: overlaysSchema.default([]),
  bgm: z.array(bgmSchema).default([]),
  lines: linesSchema.default([]),
  subtitleBands: z.array(subtitleBandSchema).default([]),
  characterSegments: z.array(characterSegmentSchema).default([]),
  ending: endingSchema.optional(),
  style: styleSchema.prefault({}),
});

export type Timeline = z.infer<typeof timelineSchema>;
