import React from "react";
import type { CalculateMetadataFunction } from "remotion";
import { Bgm } from "../components/Bgm.tsx";
import { ChapterTrack } from "../components/ChapterTrack.tsx";
import { CharacterLayer } from "../components/CharacterLayer.tsx";
import { DashcamTrack } from "../components/DashcamTrack.tsx";
import { EndingTrack } from "../components/EndingTrack.tsx";
import { HideDuring } from "../components/HideDuring.tsx";
import { NoteTrack } from "../components/NoteTrack.tsx";
import { OpeningTrack } from "../components/OpeningTrack.tsx";
import { Overlays } from "../components/Overlays.tsx";
import { PhotoTrack } from "../components/PhotoTrack.tsx";
import { SubtitleBand } from "../components/SubtitleBand.tsx";
import { Subtitles } from "../components/Subtitles.tsx";
import { VoiceLines } from "../components/VoiceLines.tsx";
import { palette, ThemeRoot } from "../theme/index.ts";
import { resolveClipSpans } from "../timeline/clips.ts";
import { toFrameSpan } from "../timeline/frames.ts";
import { loadProject, resolveProjectSlug } from "../timeline/load.ts";
import type { VoicedTimeline } from "../timeline/schema.ts";
import {
  chapterSpans,
  endingSpan,
  openingSpan,
  subtitleHiddenSpans,
  thumbnailSpan,
} from "../timeline/spans.ts";

export type MotovlogProps = { timeline: VoicedTimeline | null };

// 全トラックのフレーム区間の終端の最大値を求める。
const getTotalDurationInFrames = (
  timeline: VoicedTimeline,
  fps: number,
): number => {
  const spans: Array<{ from: number; durationInFrames: number }> = [
    ...resolveClipSpans(timeline.clips).map((span, index) =>
      toFrameSpan(span.start, timeline.clips[index].duration, fps),
    ),
    ...timeline.overlays.map((o) => toFrameSpan(o.start, o.duration, fps)),
    ...timeline.bgm.map((b) => toFrameSpan(b.start, b.duration, fps)),
    ...timeline.lines.map((l) =>
      toFrameSpan(l.start, l.duration + l.subtitleTail, fps),
    ),
    ...timeline.characterSegments.map((s) =>
      toFrameSpan(s.start, s.duration, fps),
    ),
    ...chapterSpans(timeline.chapters).map((span) =>
      toFrameSpan(span.start, span.duration, fps),
    ),
    ...timeline.notes.map((n) => toFrameSpan(n.start, n.duration, fps)),
    ...timeline.photos.map((p) => toFrameSpan(p.start, p.duration, fps)),
  ];

  const opening = openingSpan(timeline);
  if (opening) {
    spans.push(toFrameSpan(opening.start, opening.duration, fps));
  }

  const ending = endingSpan(timeline);
  if (ending) {
    spans.push(toFrameSpan(ending.start, ending.duration, fps));
  }

  const thumbnail = thumbnailSpan(timeline);
  if (thumbnail) {
    spans.push(toFrameSpan(thumbnail.start, thumbnail.duration, fps));
  }

  const ends = spans.map((span) => span.from + span.durationInFrames);

  return ends.length > 0 ? Math.max(...ends) : 1;
};

// project の選択は環境変数 REMOTION_PROJECT で行う (ADR-0004)。`--props` は
// 使わない。project の timeline.ts・voice.json を動的 import で読み、
// schema の検証と尺の算出をここで行う。
export const calculateMetadata: CalculateMetadataFunction<
  MotovlogProps
> = async () => {
  const slug = resolveProjectSlug(process.env.REMOTION_PROJECT);
  const timeline = await loadProject(slug);

  const durationInFrames = getTotalDurationInFrames(
    timeline,
    timeline.meta.fps,
  );

  return {
    width: timeline.meta.width,
    height: timeline.meta.height,
    fps: timeline.meta.fps,
    durationInFrames,
    props: { timeline },
  };
};

export const Motovlog: React.FC<MotovlogProps> = ({ timeline }) => {
  if (!timeline) {
    throw new Error("calculateMetadata が timeline を解決していません");
  }

  return (
    <ThemeRoot style={{ backgroundColor: palette.black }}>
      <DashcamTrack clips={timeline.clips} />
      <Overlays overlays={timeline.overlays} />
      <PhotoTrack photos={timeline.photos} />
      <CharacterLayer timeline={timeline} />
      <HideDuring spans={subtitleHiddenSpans(timeline)}>
        <SubtitleBand lines={timeline.lines} />
        <Subtitles lines={timeline.lines} />
      </HideDuring>
      <NoteTrack notes={timeline.notes} />
      <ChapterTrack chapters={timeline.chapters} />
      <Bgm bgm={timeline.bgm} />
      <VoiceLines lines={timeline.lines} />
      <EndingTrack timeline={timeline} />
      <OpeningTrack opening={timeline.opening} />
    </ThemeRoot>
  );
};
