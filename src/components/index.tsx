import React from "react";
import { Annotation } from "./Annotation.tsx";
import { Audio } from "./Audio.tsx";
import { ChapterTitle } from "./ChapterTitle.tsx";
import { Ending } from "./Ending.tsx";
import { PhotoShowcase } from "./PhotoShowcase.tsx";
import { Subtitle } from "./Subtitle.tsx";
import { SubtitleBand } from "./SubtitleBand.tsx";
import { Video } from "./Video.tsx";
import { assertVolume } from "./volume.ts";

// timeline.ts から各コンポーネントを関数呼び出しで並べられるようにする要素
// ファクトリ。props の型は各コンポーネントの `ComponentProps` をそのまま
// 使うので、component 側 (このファイル以外) は無変更で済む (例:
// `chapterTitle`)。thumbnail() は表情名の解決を伴うため
// src/compositions/thumbnail.ts に置く (ADR-0011)。

/** ChapterTitle の要素ファクトリ。 */
export const chapterTitle = (
  props: React.ComponentProps<typeof ChapterTitle>,
) => <ChapterTitle {...props} />;

/** Annotation の要素ファクトリ。 */
export const annotation = (props: React.ComponentProps<typeof Annotation>) => (
  <Annotation {...props} />
);

/** PhotoShowcase の要素ファクトリ。 */
export const photoShowcase = (
  props: React.ComponentProps<typeof PhotoShowcase>,
) => <PhotoShowcase {...props} />;

/** Ending の要素ファクトリ。 */
export const ending = (props: React.ComponentProps<typeof Ending>) => (
  <Ending {...props} />
);

/**
 * Subtitle の要素ファクトリ。声の無い字幕 (narration() に duration を明示した
 * 項目として置く) のためのファクトリ。line() は Line が Subtitle を直接描く
 * ためこれを使わない。
 */
export const subtitle = (props: React.ComponentProps<typeof Subtitle>) => (
  <Subtitle {...props} />
);

/** SubtitleBand の要素ファクトリ。 */
export const subtitleBand = (
  props: React.ComponentProps<typeof SubtitleBand>,
) => <SubtitleBand {...props} />;

/** Video の要素ファクトリ。不正な volume はここで throw する。 */
export const video = (props: React.ComponentProps<typeof Video>) => {
  assertVolume(props.volume ?? 1);

  return <Video {...props} />;
};

/** Audio の要素ファクトリ。不正な volume はここで throw する。 */
export const audio = (props: React.ComponentProps<typeof Audio>) => {
  assertVolume(props.volume ?? 1);

  return <Audio {...props} />;
};
