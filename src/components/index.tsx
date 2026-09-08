import React from "react";
import { ChapterTitle } from "./ChapterTitle.tsx";
import { Ending } from "./Ending.tsx";
import { OpeningFrame } from "./OpeningFrame.tsx";
import { PhotoShowcase } from "./PhotoShowcase.tsx";
import { Subtitle } from "./Subtitle.tsx";
import { SubtitleBand } from "./SubtitleBand.tsx";
import { VerticalNote } from "./VerticalNote.tsx";

/**
 * timeline.ts から各コンポーネントを関数呼び出しで並べられるようにする要素
 * ファクトリ。props の型は各コンポーネントの `ComponentProps` をそのまま
 * 使うので、component 側 (このファイル以外) は無変更で済む。
 */
export const openingFrame = (
  props: React.ComponentProps<typeof OpeningFrame>,
) => <OpeningFrame {...props} />;

/** ChapterTitle の要素ファクトリ。 */
export const chapterTitle = (
  props: React.ComponentProps<typeof ChapterTitle>,
) => <ChapterTitle {...props} />;

/** VerticalNote の要素ファクトリ。 */
export const verticalNote = (
  props: React.ComponentProps<typeof VerticalNote>,
) => <VerticalNote {...props} />;

/** PhotoShowcase の要素ファクトリ。 */
export const photoShowcase = (
  props: React.ComponentProps<typeof PhotoShowcase>,
) => <PhotoShowcase {...props} />;

/** Ending の要素ファクトリ。 */
export const ending = (props: React.ComponentProps<typeof Ending>) => (
  <Ending {...props} />
);

/** Subtitle の要素ファクトリ。 */
export const subtitle = (props: React.ComponentProps<typeof Subtitle>) => (
  <Subtitle {...props} />
);

/** SubtitleBand の要素ファクトリ。 */
export const subtitleBand = (
  props: React.ComponentProps<typeof SubtitleBand>,
) => <SubtitleBand {...props} />;
