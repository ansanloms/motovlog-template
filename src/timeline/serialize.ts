import type { z } from "zod";
import type { serializedEndingSchema, Timeline } from "./schema.ts";

// timelineSchema.parse の結果 (作者向け、ending.date・ridingTime が
// Temporal のインスタンス) の ending を props 向け (ISO 文字列) に差し替えた
// 形。ending 以外は Timeline のまま (ADR-0009)。
export type SerializedTimeline = Omit<Timeline, "ending"> & {
  ending?: z.infer<typeof serializedEndingSchema>;
};

// timeline.ts が書いた Temporal のインスタンス (ending.date.from/to・
// ridingTime) を、Remotion の calculateMetadata が返せる ISO 文字列に変換する
// (ADR-0009)。ending 以外はそのまま返す。mergeVoice に渡す前に必ず通す
// (voicedTimelineSchema は ISO 文字列を検証する serializedEndingSchema を使う
// ため、Temporal のインスタンスのままだと ZodError になる)。
export const serializeTimeline = (timeline: Timeline): SerializedTimeline => {
  const { ending, ...rest } = timeline;

  if (!ending) {
    return rest;
  }

  return {
    ...rest,
    ending: {
      ...ending,
      date: {
        from: ending.date.from.toString(),
        to: ending.date.to.toString(),
      },
      ridingTime: ending.ridingTime.toString(),
    },
  };
};
