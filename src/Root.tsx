import React from "react";
import { Composition } from "remotion";
import { z } from "zod";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog";
import {
  ChapterTitleGallery,
  galleryDurationInFrames as chapterTitleGalleryDurationInFrames,
} from "./gallery/ChapterTitleGallery";
import { galleryFps } from "./gallery/shared";
import {
  galleryDurationInFrames as subtitlesGalleryDurationInFrames,
  SubtitlesGallery,
} from "./gallery/SubtitlesGallery";
import { voicedTimelineSchema } from "./timeline/schema";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Motovlog"
        component={Motovlog}
        schema={z.object({ timeline: voicedTimelineSchema.nullable() })}
        defaultProps={{ timeline: null }}
        calculateMetadata={calculateMetadata}
      />
      {/* コンポーネント単体の確認用 (ADR-0007, ADR-0008)。timeline は使わない。 */}
      <Composition
        id="Gallery-Subtitles"
        component={SubtitlesGallery}
        width={1920}
        height={1080}
        fps={galleryFps}
        durationInFrames={subtitlesGalleryDurationInFrames}
      />
      <Composition
        id="Gallery-ChapterTitle"
        component={ChapterTitleGallery}
        width={1920}
        height={1080}
        fps={galleryFps}
        durationInFrames={chapterTitleGalleryDurationInFrames}
      />
    </>
  );
};
