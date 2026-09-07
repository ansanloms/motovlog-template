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

// audio・duration は voice.json との合成後にしか定まらない (ADR-0006)。
// timeline.ts 側の line はここには持たず、合成後の voicedLineSchema に足す。
const lineSchema = z.object({
  id: z.string(),
  start: z.number().nonnegative(),
  // 字幕表示文。
  text: z.string(),
  // 音声終了後に字幕を残す秒。
  subtitleTail: z.number().nonnegative().default(0.4),
});

// start 昇順に並べ、隣接する line 同士の区間 [start, start + duration) が
// 重ならないことを検証する (Subtitles.tsx の clamp は隣接前提の保険であって
// 重なりの許容ではない)。timeline.ts 単体では duration が定まらないため、
// audio・duration を合成済みの voicedLinesSchema からだけ呼ぶ。
const checkLineOverlaps = (
  lines: Array<{ id: string; start: number; duration: number }>,
  ctx: z.core.$RefinementCtx,
) => {
  const sorted = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.start - b.line.start);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];

    if (next.line.start < prev.line.start + prev.line.duration) {
      ctx.addIssue({
        code: "custom",
        message: `start は直前の line (index ${prev.index}) の終了 (start + duration) 以降にしてください: ${next.line.id}`,
        path: [next.index, "start"],
      });
    }
  }
};

// lines は id を key として参照される想定 (Sequence の key 等) のため、
// 重複があると描画・追跡が破綻する。timeline.ts 単体 (linesSchema) と
// voice.json 合成後 (voicedLinesSchema) の両方から呼ぶ。区間の重なり検証は
// voice.json との合成後 (voicedLinesSchema) でだけ行う (checkLineOverlaps)。
const checkDuplicateIds = (
  lines: Array<{ id: string }>,
  ctx: z.core.$RefinementCtx,
) => {
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
};

const linesSchema = z
  .array(lineSchema)
  .superRefine((lines, ctx) => checkDuplicateIds(lines, ctx));

// voice.json (ADR-0006) の line エントリ。looseObject にしているのは、
// 作り直し中の音声生成スクリプトが speaker・reading・lipsync・generatedAt 等を
// 今後書き足す想定のため。ここでの読み込みは audio・duration だけを使う。
const voiceLineSchema = z.looseObject({
  audio: z.string(),
  duration: z.number().positive(),
});

export const voiceSchema = z.object({
  version: z.literal(1),
  lines: z.record(z.string(), voiceLineSchema),
});

export type Voice = z.infer<typeof voiceSchema>;

// timeline.ts の line に voice.json の audio・duration を足した形。
const voicedLineSchema = lineSchema.extend({
  audio: z.string(),
  duration: z.number().positive(),
});

const voicedLinesSchema = z
  .array(voicedLineSchema)
  .superRefine((lines, ctx) => {
    checkDuplicateIds(lines, ctx);
    checkLineOverlaps(lines, ctx);
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

export const timelineSchema = z.object({
  // ADR-0004: 互換性を切る変更で上げる。
  version: z.literal(1).default(1),
  meta: metaSchema.prefault({}),
  clips: clipsSchema,
  overlays: overlaysSchema.default([]),
  bgm: z.array(bgmSchema).default([]),
  lines: linesSchema.default([]),
  characterSegments: z.array(characterSegmentSchema).default([]),
  ending: endingSchema.optional(),
});

export type Timeline = z.infer<typeof timelineSchema>;

// timeline.ts の lines に voice.json の audio・duration を合成した形。
// Composition の schema にも使う (calculateMetadata が渡す props の型)。
export const voicedTimelineSchema = timelineSchema.extend({
  lines: voicedLinesSchema.default([]),
});

export type VoicedTimeline = z.infer<typeof voicedTimelineSchema>;

// timeline.ts に書く際の型補完用。実行時は入力をそのまま返し、parse はしない
// (parse は timelineSchema.parse が行う。projects/<slug>/timeline.ts の
// `export default defineTimeline({...})` の形で使う)。
export const defineTimeline = (
  timeline: z.input<typeof timelineSchema>,
): z.input<typeof timelineSchema> => timeline;

// timeline (schema 検証済み、audio・duration 無し) と voice (voice.json、
// schema 検証済み) を line の id で合成し、VoicedTimeline を返す。
//
// 失敗は 2 種類ある。
// - timeline.lines に、対応する voice.lines が無い id がある場合: 音声が
//   未生成であることを示す Error (ZodError ではない) を投げる。
// - 合成結果が voicedTimelineSchema の検証 (line 区間の重なり等) を通らない
//   場合: parse がそのまま投げる ZodError を伝播させる。
//
// voice.lines にだけあり timeline.lines に無い id は無視する。
export const mergeVoice = (
  timeline: Timeline,
  voice: Voice,
  slug: string,
): VoicedTimeline => {
  const missingIds = timeline.lines
    .map((line) => line.id)
    .filter((id) => !Object.prototype.hasOwnProperty.call(voice.lines, id));

  if (missingIds.length > 0) {
    throw new Error(
      `音声が未生成です。projects/${slug}/voice.json に次の id の生成結果がありません (ADR-0006 の音声生成スクリプトで生成する): ${missingIds.join(", ")}`,
    );
  }

  return voicedTimelineSchema.parse({
    ...timeline,
    lines: timeline.lines.map((line) => ({
      ...line,
      audio: voice.lines[line.id].audio,
      duration: voice.lines[line.id].duration,
    })),
  });
};
