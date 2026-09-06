import { Video } from "@remotion/media";
import React, { useMemo } from "react";
import {
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveClipSpans } from "../timeline/clips";
import { fadeEnvelope, secondsToFrames, toFrameSpan } from "../timeline/frames";
import type { Timeline } from "../timeline/schema";

type Props = {
  clips: Timeline["clips"];
};

// メイン映像トラック (ドライブレコーダー相当の走行映像)。
//
// clips は絶対位置を持たない順序リストで、各クリップの絶対区間は
// resolveClipSpans が導出する (gapBefore/crossfadeIn/duration の幾何的な
// 整合は schema の superRefine が保証済みなので、ここで clamp は行わない)。
export const DashcamTrack: React.FC<Props> = ({ clips }) => {
  const { fps } = useVideoConfig();

  // 秒区間 (resolveClipSpans) をフレーム化した配列を先に作る。フェードの
  // 重なりフレーム数はこの配列同士の突き合わせから導出するため、各クリップが
  // 独立に crossfadeIn を丸めた場合と異なり、隣接区間との丸め不一致が
  // 構造的に生じない。
  const frameSpans = useMemo(() => {
    const spans = resolveClipSpans(clips);
    return clips.map((clip, index) =>
      toFrameSpan(spans[index].start, clip.duration, fps),
    );
  }, [clips, fps]);

  return (
    <>
      {clips.map((clip, index) => {
        const own = frameSpans[index];
        const prev = frameSpans[index - 1];
        const next = frameSpans[index + 1];

        // フェードイン = 前クリップの区間と自身の区間の重なりフレーム数。
        const crossfadeInFrames = prev
          ? Math.max(0, prev.from + prev.durationInFrames - own.from)
          : 0;
        // フェードアウト = 次クリップの区間と自身の区間の重なりフレーム数。
        const nextCrossfadeFrames = next
          ? Math.max(0, own.from + own.durationInFrames - next.from)
          : 0;

        return (
          <Sequence
            key={`${clip.src}-${index}`}
            from={own.from}
            durationInFrames={own.durationInFrames}
          >
            <CrossfadingClip
              clip={clip}
              durationInFrames={own.durationInFrames}
              crossfadeInFrames={crossfadeInFrames}
              nextCrossfadeFrames={nextCrossfadeFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const CrossfadingClip: React.FC<{
  clip: Timeline["clips"][number];
  durationInFrames: number;
  crossfadeInFrames: number;
  nextCrossfadeFrames: number;
}> = ({ clip, durationInFrames, crossfadeInFrames, nextCrossfadeFrames }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const sourceFromFrames = secondsToFrames(clip.sourceFrom, fps);

  // 映像側は入る側 (自身の crossfadeIn) だけフェードインする。
  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames: crossfadeInFrames,
    fadeOutFrames: 0,
  });

  return (
    <Video
      src={staticFile(clip.src)}
      trimBefore={sourceFromFrames}
      // <Video> の volume はコールバック (frame) => number を受け付ける型
      // (VolumeProp = number | ((frame: number) => number)) なので、
      // 自身の crossfadeIn (フェードイン) と次クリップの crossfadeIn
      // (自身の末尾でのフェードアウト) の両方をここで音量に反映する。
      volume={(f) =>
        fadeEnvelope({
          frame: f,
          durationInFrames,
          fadeInFrames: crossfadeInFrames,
          fadeOutFrames: nextCrossfadeFrames,
          peak: clip.volume,
        })
      }
      objectFit="cover"
      style={{ width: "100%", height: "100%", opacity }}
    />
  );
};
