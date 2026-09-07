import React, { useMemo } from "react";
import type { CalculateMetadataFunction } from "remotion";
import { AbsoluteFill, getInputProps } from "remotion";
import { ZodError } from "zod";
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
import { assertVoiced, timelineSchema } from "../timeline/schema";
import type { Timeline, VoicedTimeline } from "../timeline/schema";

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
  // Remotion は `--props` を defaultProps と浅くマージするため、project の
  // timeline.json でコンテナ (clips 等) を省略すると defaultProps (サンプル)
  // の値を引き継いでしまう。input props が 1 つでもあればそれだけを単独で
  // parse し、defaultProps との混在を避ける。
  //
  // また `--props` 等で default 付き項目 (fadeDuration / subtitleTail 等) を
  // 省略した場合、ここで parse しないと undefined のまま各所の計算に
  // 渡って NaN 尺になる。parse 結果を props として返し、以降の描画にも
  // default 補完済みの値を使わせる。
  // getInputProps() は window が無い環境では警告を出して {} を返し、window
  // はあるが remotion_inputProps が未設定のとき、および <Player> 内で呼ぶと
  // 例外を投げる。ここでは前者 2 つをガードする。このリポジトリは <Player>
  // を使わないため isPlayer は見ていない (Player に載せる場合は Remotion の
  // ResolveCompositionConfig と同じく isPlayer の判定を足すこと)。
  const hasInputProps =
    typeof window !== "undefined" &&
    typeof (window as { remotion_inputProps?: unknown }).remotion_inputProps !==
      "undefined";
  const inputProps = hasInputProps ? getInputProps() : {};
  const hasNonEmptyInputProps = Object.keys(inputProps).length > 0;
  const source = hasNonEmptyInputProps ? inputProps : props;

  let parsed: Timeline;
  try {
    parsed = timelineSchema.parse(source);
  } catch (error) {
    if (hasNonEmptyInputProps && error instanceof ZodError) {
      throw new Error(
        `--props で渡した timeline は完全な定義である必要があります (defaultProps とは混ぜません): ${error.message}`,
      );
    }
    throw error;
  }

  // 音声が未生成の line があれば、ここで明確なエラーとして拒否する (ADR-0006)。
  const voiced = assertVoiced(parsed);

  const durationInFrames = getTotalDurationInFrames(voiced, voiced.meta.fps);

  return {
    width: voiced.meta.width,
    height: voiced.meta.height,
    fps: voiced.meta.fps,
    durationInFrames,
    props: voiced,
  };
};

export const Motovlog: React.FC<Timeline> = (props) => {
  const timeline = useMemo(() => assertVoiced(props), [props]);

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
