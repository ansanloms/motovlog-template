import { z } from "zod";
import { chapterTitleDurationSec, openingTiming } from "../theme/timing.ts";
// SerializedTimeline は型のみ参照する (実体は serialize.ts が持ち、
// serializeTimeline は Timeline・serializedEndingSchema を型のみ参照する形の
// 相互参照になるが、どちらも import type のため実行時の循環importは無い)。
import type { SerializedTimeline } from "./serialize.ts";

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

/**
 * 立ち絵の表示区間。src は PNG 1 枚 (public 相対)。フェード (0.2 秒) は
 * theme が持つ。目パチ・口パクは #39 で足す。
 */
const characterSegmentSchema = z.object({
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  src: z.string().min(1),
  side: z.enum(["left", "right"]).default("left"),
});

/**
 * OP (冒頭 openingTiming.duration 秒) とサムネ用フレーム (ED の後
 * thumbnailFrameTiming.duration 秒) の共通の絵。尺とフェードは theme が持つ。
 */
export const openingSchema = z.object({
  // 走行写真 (public 相対)。
  photo: z.string().min(1),
  // バッジの文字列 (例 "#12 愛媛 / 国道378号")。
  badge: z.string().min(1),
  // 地名。最大 12 文字 (運用の規則、コードでは縛らない)。改行可。
  title: z.string().min(1),
  // 立ち絵 png (public 相対)。
  character: z.string().min(1),
});

/**
 * 章タイトル。番号は start 順の 1 始まり (spans.ts の chapterSpans が導出)。
 * 尺 (chapterTitleDurationSec) は theme が持つ。
 */
export const chapterSchema = z.object({
  start: z.number().nonnegative(),
  title: z.string().min(1),
});

/** 右端の縦書き注釈。カットで出し入れする。 */
export const noteSchema = z.object({
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  // 改行で列を分ける (VerticalNote.tsx)。
  text: z.string().min(1),
});

/** 写真紹介。1 枚か 2 枚。3 枚以上は要素を続けて並べる (カットで順送り)。 */
export const photoSchema = z.object({
  start: z.number().nonnegative(),
  duration: z.number().positive(),
  src: z.array(z.string().min(1)).min(1).max(2),
});

// 走行日の範囲 (ADR-0009)。作者向け (timeline.ts が書く形) は
// Temporal.ZonedDateTime をそのまま受ける。from が to より後の指定は拒否する。
// 比較は各値のゾーンの暦日 (表示と同じ基準、formatDateRange 参照)。
const authorDateRangeSchema = z
  .object({
    from: z.instanceof(Temporal.ZonedDateTime),
    to: z.instanceof(Temporal.ZonedDateTime),
  })
  .superRefine((date, ctx) => {
    if (
      Temporal.PlainDate.compare(
        date.from.toPlainDate(),
        date.to.toPlainDate(),
      ) > 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "from は to 以前にしてください",
        path: ["from"],
      });
    }
  });

// props 向け (serializeTimeline が ISO 文字列へ変換した後の形。ADR-0009:
// Remotion の calculateMetadata が返せる値の制約により、Temporal の
// インスタンスは props に載せられない)。EndingTrack が
// Temporal.ZonedDateTime.from()/Temporal.Duration.from() で戻す。
const isoZonedDateTime = z.string().refine(
  (value) => {
    try {
      Temporal.ZonedDateTime.from(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Temporal.ZonedDateTime.from() で解釈できる文字列にしてください" },
);

const isoDuration = z.string().refine(
  (value) => {
    try {
      Temporal.Duration.from(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Temporal.Duration.from() で解釈できる文字列にしてください" },
);

// ridingTime は日・時・分・秒だけの非負の Duration に限る (year/month/week は
// 暦依存で長さが一定でないため km/h 換算等に使えない)。作者向け
// (Temporal.Duration のインスタンス) と props 向け (ISO 文字列) の両方に同じ
// 制約をかける。
const isRidingTimeDuration = (duration: Temporal.Duration): boolean =>
  duration.years === 0 &&
  duration.months === 0 &&
  duration.weeks === 0 &&
  duration.sign >= 0;

const ridingTimeMessage =
  "走行時間は日・時・分・秒だけの非負の Duration にしてください";

const authorRidingTimeSchema = z
  .instanceof(Temporal.Duration)
  .refine(isRidingTimeDuration, { message: ridingTimeMessage });

// isoDuration が既に Temporal.Duration.from() で解釈できることを検証済みの
// ため、ここでは形式エラーを重ねて出さないよう解釈失敗時は true を返す。
const serializedRidingTimeSchema = isoDuration.refine(
  (value) => {
    try {
      return isRidingTimeDuration(Temporal.Duration.from(value));
    } catch {
      return true;
    }
  },
  { message: ridingTimeMessage },
);

// isoZonedDateTime が既に Temporal.ZonedDateTime.from() で解釈できることを
// 検証済みのため、ここでは形式エラーを重ねて出さないよう解釈失敗時は issue を
// 足さずに return する (serializedRidingTimeSchema と同じ形)。比較は各値の
// ゾーンの暦日 (表示と同じ基準、formatDateRange 参照)。
const serializedDateRangeSchema = z
  .object({
    from: isoZonedDateTime,
    to: isoZonedDateTime,
  })
  .superRefine((date, ctx) => {
    let from: Temporal.ZonedDateTime;
    let to: Temporal.ZonedDateTime;

    try {
      from = Temporal.ZonedDateTime.from(date.from);
      to = Temporal.ZonedDateTime.from(date.to);
    } catch {
      return;
    }

    if (Temporal.PlainDate.compare(from.toPlainDate(), to.toPlainDate()) > 0) {
      ctx.addIssue({
        code: "custom",
        message: "from は to 以前にしてください",
        path: ["from"],
      });
    }
  });

// ED (走行データとクレジット、endingTiming.duration 秒) の共通部分。start は
// 最後のクリップからカットインする秒。opening があれば ED の後にサムネ用
// フレームが続く。date・ridingTime だけ作者向け/props 向けで型が異なるため
// (ADR-0009)、endingSchema・serializedEndingSchema へそれぞれ extend する。
const endingShape = {
  start: z.number().nonnegative(),
  // 上段左の文字列。既定は "RIDE LOG"。
  title: z.string().min(1).default("RIDE LOG"),
  // 上段右の文字列 (例 "EP.12 / 愛媛")。
  subtitle: z.string().min(1),
  // km。
  distance: z.number().nonnegative(),
  // 5〜7 か所は運用の規則 (コードでは縛らない)。
  routes: z.array(z.string().min(1)).min(1),
  // 1 要素 = 1 行。key: value で表示。URL は出さず概要欄に置く。
  credits: z.array(z.record(z.string(), z.string())).default([]),
};

// 作者向け (timeline.ts が書く形)。timelineSchema が使う。
export const endingSchema = z.object({
  ...endingShape,
  date: authorDateRangeSchema,
  ridingTime: authorRidingTimeSchema,
});

// props 向け (serializeTimeline が変換した後の形)。voicedTimelineSchema が使う。
export const serializedEndingSchema = z.object({
  ...endingShape,
  date: serializedDateRangeSchema,
  ridingTime: serializedRidingTimeSchema,
});

/**
 * start 順に並べた要素の区間 [start, start + duration) が互いに重ならない
 * ことを検証する (notes・photos で共用)。
 */
const checkNoOverlap = (
  items: ReadonlyArray<{ start: number; duration: number }>,
  track: "characterSegments" | "chapters" | "notes" | "photos",
  message: string,
  ctx: z.core.$RefinementCtx,
) => {
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.start - b.item.start);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];

    if (next.item.start < prev.item.start + prev.item.duration) {
      ctx.addIssue({
        code: "custom",
        message,
        path: [track, next.index, "start"],
      });
    }
  }
};

/** opening の直後 (openingTiming.duration 秒) より前に始まる要素を拒否する。 */
const checkAfterOpening = (
  items: ReadonlyArray<{ start: number }>,
  track: "characterSegments" | "chapters" | "notes" | "photos",
  ctx: z.core.$RefinementCtx,
) => {
  items.forEach((item, index) => {
    if (item.start < openingTiming.duration) {
      ctx.addIssue({
        code: "custom",
        message: "opening の表示が終わった後に開始してください",
        path: [track, index, "start"],
      });
    }
  });
};

/** ending (ending.start 秒) より後まで表示が続く要素を拒否する。 */
const checkBeforeEnding = (
  items: ReadonlyArray<{ start: number; end: number }>,
  track: "characterSegments" | "chapters" | "notes" | "photos",
  endingStart: number,
  ctx: z.core.$RefinementCtx,
) => {
  items.forEach((item, index) => {
    if (item.end > endingStart) {
      ctx.addIssue({
        code: "custom",
        message: "ending が始まる前に終わるようにしてください",
        path: [track, index, "start"],
      });
    }
  });
};

// timelineSchema・voicedTimelineSchema の両方にかける横断検証。ending は
// start (number) しか見ないため、ending.date・ridingTime が Temporal の
// インスタンスでも ISO 文字列 (ADR-0009) でも同じ関数で動く。
// `.safeExtend()` は上書きするキーの型が元の型と互換 (output/input とも
// 部分型) でないと型エラーになり (zod/v4/classic/schemas.d.ts の
// SafeExtendShape)、ending (Temporal → 文字列) の差し替えには使えない。その
// ため voicedTimelineSchema は timelineSchema.shape を土台に組み立て直し、
// この検証関数を共有する。
type TimelineForRefinements = {
  opening?: unknown;
  characterSegments: ReadonlyArray<{ start: number; duration: number }>;
  chapters: ReadonlyArray<{ start: number }>;
  notes: ReadonlyArray<{ start: number; duration: number }>;
  photos: ReadonlyArray<{ start: number; duration: number }>;
  ending?: { start: number };
};

const timelineRefinements = (
  timeline: TimelineForRefinements,
  ctx: z.core.$RefinementCtx,
) => {
  checkNoOverlap(
    timeline.characterSegments,
    "characterSegments",
    "立ち絵の表示区間が重なっています",
    ctx,
  );

  checkNoOverlap(
    timeline.chapters.map((chapter) => ({
      start: chapter.start,
      duration: chapterTitleDurationSec,
    })),
    "chapters",
    "章タイトルの表示区間が重なっています",
    ctx,
  );

  checkNoOverlap(
    timeline.notes,
    "notes",
    "注釈の表示区間が重なっています",
    ctx,
  );

  checkNoOverlap(
    timeline.photos,
    "photos",
    "写真紹介の表示区間が重なっています",
    ctx,
  );

  if (timeline.opening) {
    checkAfterOpening(timeline.characterSegments, "characterSegments", ctx);
    checkAfterOpening(timeline.chapters, "chapters", ctx);
    checkAfterOpening(timeline.notes, "notes", ctx);
    checkAfterOpening(timeline.photos, "photos", ctx);
  }

  if (timeline.ending) {
    const endingStart = timeline.ending.start;

    checkBeforeEnding(
      timeline.characterSegments.map((segment) => ({
        start: segment.start,
        end: segment.start + segment.duration,
      })),
      "characterSegments",
      endingStart,
      ctx,
    );

    checkBeforeEnding(
      timeline.chapters.map((chapter) => ({
        start: chapter.start,
        end: chapter.start + chapterTitleDurationSec,
      })),
      "chapters",
      endingStart,
      ctx,
    );

    checkBeforeEnding(
      timeline.notes.map((note) => ({
        start: note.start,
        end: note.start + note.duration,
      })),
      "notes",
      endingStart,
      ctx,
    );

    checkBeforeEnding(
      timeline.photos.map((photo) => ({
        start: photo.start,
        end: photo.start + photo.duration,
      })),
      "photos",
      endingStart,
      ctx,
    );
  }
};

export const timelineSchema = z
  .object({
    // ADR-0004: 互換性を切る変更で上げる。
    version: z.literal(1).default(1),
    meta: metaSchema.prefault({}),
    opening: openingSchema.optional(),
    clips: clipsSchema,
    overlays: overlaysSchema.default([]),
    bgm: z.array(bgmSchema).default([]),
    lines: linesSchema.default([]),
    characterSegments: z.array(characterSegmentSchema).default([]),
    chapters: z.array(chapterSchema).default([]),
    notes: z.array(noteSchema).default([]),
    photos: z.array(photoSchema).default([]),
    ending: endingSchema.optional(),
  })
  .superRefine(timelineRefinements);

export type Timeline = z.infer<typeof timelineSchema>;

// timeline.ts の lines に voice.json の audio・duration を合成した形。
// Composition の schema にも使う (calculateMetadata が渡す props の型)。
// ending は props 向け (serializedEndingSchema、ADR-0009) に差し替える。
export const voicedTimelineSchema = z
  .object({
    ...timelineSchema.shape,
    lines: voicedLinesSchema.default([]),
    ending: serializedEndingSchema.optional(),
  })
  .superRefine(timelineRefinements);

export type VoicedTimeline = z.infer<typeof voicedTimelineSchema>;

// timeline.ts に書く際の型補完用。実行時は入力をそのまま返し、parse はしない
// (parse は timelineSchema.parse が行う。projects/<slug>/timeline.ts の
// `export default defineTimeline({...})` の形で使う)。
export const defineTimeline = (
  timeline: z.input<typeof timelineSchema>,
): z.input<typeof timelineSchema> => timeline;

// timeline (serializeTimeline 済み、audio・duration 無し) と voice
// (voice.json、schema 検証済み) を line の id で合成し、VoicedTimeline を
// 返す。timeline は serializeTimeline を通した後の形 (ending の date・
// ridingTime が ISO 文字列) を受ける。timelineSchema.parse の結果
// (Temporal のインスタンスを持つ Timeline) をそのまま渡すと、
// voicedTimelineSchema の再検証で型が合わず ZodError になる (ADR-0009)。
//
// 失敗は 2 種類ある。
// - timeline.lines に、対応する voice.lines が無い id がある場合: 音声が
//   未生成であることを示す Error (ZodError ではない) を投げる。
// - 合成結果が voicedTimelineSchema の検証 (line 区間の重なり等) を通らない
//   場合: parse がそのまま投げる ZodError を伝播させる。
//
// voice.lines にだけあり timeline.lines に無い id は無視する。
export const mergeVoice = (
  timeline: SerializedTimeline,
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
