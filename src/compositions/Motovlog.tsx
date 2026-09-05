import React from "react";
import type { CalculateMetadataFunction } from "remotion";
import { AbsoluteFill } from "remotion";
import { Bgm } from "../components/Bgm";
import { CharacterLayer } from "../components/CharacterLayer";
import { DashcamTrack } from "../components/DashcamTrack";
import { Ending } from "../components/Ending";
import { Overlays } from "../components/Overlays";
import { SubtitleBand } from "../components/SubtitleBand";
import { Subtitles } from "../components/Subtitles";
import { VoiceLines } from "../components/VoiceLines";
import { resolveClipSpans } from "../timeline/clips";
import { toFrameSpan } from "../timeline/frames";
import { timelineSchema } from "../timeline/schema";
import type { Timeline } from "../timeline/schema";

// 全トラックのフレーム区間の終端の最大値を求める。
const getTotalDurationInFrames = (timeline: Timeline, fps: number): number => {
  const spans: Array<{ from: number; durationInFrames: number }> = [
    ...resolveClipSpans(timeline.clips).map((span) =>
      toFrameSpan(span.start, span.end - span.start, fps),
    ),
    ...timeline.overlays.map((o) => toFrameSpan(o.start, o.duration, fps)),
    ...timeline.bgm.map((b) => toFrameSpan(b.start, b.duration, fps)),
    ...timeline.lines.map((l) =>
      toFrameSpan(l.start, l.duration + l.subtitleTail, fps),
    ),
    ...timeline.subtitleBands.map((b) => toFrameSpan(b.start, b.duration, fps)),
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

export const calculateMetadata: CalculateMetadataFunction<Timeline> = ({
  props,
}) => {
  // `--props` 等で default 付き項目 (fadeDuration / subtitleTail 等) を
  // 省略した場合、ここで parse しないと undefined のまま各所の計算に
  // 渡って NaN 尺になる。parse 結果を props として返し、以降の描画にも
  // default 補完済みの値を使わせる。
  const parsed = timelineSchema.parse(props);
  const durationInFrames = getTotalDurationInFrames(parsed, parsed.meta.fps);

  return {
    width: parsed.meta.width,
    height: parsed.meta.height,
    fps: parsed.meta.fps,
    durationInFrames,
    props: parsed,
  };
};

export const Motovlog: React.FC<Timeline> = (timeline) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <DashcamTrack clips={timeline.clips} />
      <Overlays overlays={timeline.overlays} />
      <CharacterLayer segments={timeline.characterSegments} />
      <SubtitleBand
        bands={timeline.subtitleBands}
        style={timeline.style.band}
      />
      <Subtitles lines={timeline.lines} style={timeline.style.subtitle} />
      <Bgm bgm={timeline.bgm} />
      <VoiceLines lines={timeline.lines} />
      <Ending ending={timeline.ending} />
    </AbsoluteFill>
  );
};
