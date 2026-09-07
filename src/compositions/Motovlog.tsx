import React from "react";
import type { CalculateMetadataFunction } from "remotion";
import { Bgm } from "../components/Bgm";
import { CharacterLayer } from "../components/CharacterLayer";
import { DashcamTrack } from "../components/DashcamTrack";
import { Ending } from "../components/Ending";
import { Overlays } from "../components/Overlays";
import { SubtitleBand } from "../components/SubtitleBand";
import { Subtitles } from "../components/Subtitles";
import { VoiceLines } from "../components/VoiceLines";
import { ThemeRoot } from "../theme";
import { resolveClipSpans } from "../timeline/clips";
import { toFrameSpan } from "../timeline/frames";
import { loadProject, resolveProjectSlug } from "../timeline/load";
import type { VoicedTimeline } from "../timeline/schema";

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
  ];

  if (timeline.ending) {
    spans.push(
      toFrameSpan(
        timeline.ending.fadeToBlackStart,
        timeline.ending.fadeDuration,
        fps,
      ),
    );

    if (timeline.ending.credits) {
      spans.push(
        toFrameSpan(
          timeline.ending.credits.start,
          timeline.ending.credits.duration,
          fps,
        ),
      );
    }
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
    // 暗転の色は ED の再設計で theme に寄せる。
    <ThemeRoot style={{ backgroundColor: "#000000" }}>
      <DashcamTrack clips={timeline.clips} />
      <Overlays overlays={timeline.overlays} />
      <CharacterLayer segments={timeline.characterSegments} />
      <SubtitleBand lines={timeline.lines} />
      <Subtitles lines={timeline.lines} />
      <Bgm bgm={timeline.bgm} />
      <VoiceLines lines={timeline.lines} />
      <Ending ending={timeline.ending} />
    </ThemeRoot>
  );
};
