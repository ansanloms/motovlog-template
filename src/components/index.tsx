import React from "react";
import { Annotation } from "./Annotation.tsx";
import { ChapterTitle } from "./ChapterTitle.tsx";
import { Ending } from "./Ending.tsx";
import { PhotoShowcase } from "./PhotoShowcase.tsx";
import { Subtitle } from "./Subtitle.tsx";
import { SubtitleBand } from "./SubtitleBand.tsx";
import { Thumbnail } from "./Thumbnail.tsx";
import { Video } from "./Video.tsx";

/**
 * timeline.ts から各コンポーネントを関数呼び出しで並べられるようにする要素
 * ファクトリ。props の型は各コンポーネントの `ComponentProps` をそのまま
 * 使うので、component 側 (このファイル以外) は無変更で済む。
 */
export const thumbnail = (props: React.ComponentProps<typeof Thumbnail>) => (
  <Thumbnail {...props} />
);

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

/** Subtitle の要素ファクトリ。 */
export const subtitle = (props: React.ComponentProps<typeof Subtitle>) => (
  <Subtitle {...props} />
);

/** SubtitleBand の要素ファクトリ。 */
export const subtitleBand = (
  props: React.ComponentProps<typeof SubtitleBand>,
) => <SubtitleBand {...props} />;

/** Video の要素ファクトリ。 */
export const video = (props: React.ComponentProps<typeof Video>) => (
  <Video {...props} />
);
