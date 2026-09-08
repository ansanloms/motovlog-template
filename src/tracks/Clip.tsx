import { Video } from "@remotion/media";
import React, { useMemo } from "react";
import {
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveClipSpans } from "../timeline/clips.ts";
import {
  fadeEnvelope,
  secondsToFrames,
  toFrameSpan,
} from "../timeline/frames.ts";
import type { Timeline } from "../timeline/schema.ts";

type Props = {
  clips: Timeline["clips"];
};

// メイン映像トラック (ドライブレコーダー相当の走行映像)。
//
// clips は絶対位置を持たない順序リストで、各クリップの絶対区間は
// resolveClipSpans が導出する (gapBefore/crossfadeIn/duration の幾何的な
// 整合は schema の superRefine が保証済みなので、ここで clamp は行わない)。
export const Clip: React.FC<Props> = ({ clips }) => {
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
  // 重なりの最終フレーム (crossfadeInFrames - 1) で不透明度・音量が 1 に
  // 達するようにする。crossfadeInFrames が 1 以下 (重なりが 1 フレーム以下)
  // のときは fadeEnvelope の fadeInFrames <= 0 の扱いにより常に 1 になる。
  const opacityFadeInFrames = crossfadeInFrames - 1;
  // 音量側のフェードアウトの分母。フェードインと同じ (N - 1) 分母を使うことで、
  // 重なり中の 2 本の音量の合計を各フレームで 1 に保つ。重なりが 1 フレームの
  // ときだけ N - 1 = 0 になり fadeEnvelope のフォールバック (常に peak) が
  // 働いて合計が 1 から外れるため、その場合だけ分母を 1 に固定する。
  const volumeFadeOutFrames =
    nextCrossfadeFrames === 1 ? 1 : nextCrossfadeFrames - 1;

  // 映像側は入る側 (自身の crossfadeIn) だけフェードインする。
  const opacity = fadeEnvelope({
    frame,
    durationInFrames,
    fadeInFrames: opacityFadeInFrames,
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
          fadeInFrames: opacityFadeInFrames,
          fadeOutFrames: volumeFadeOutFrames,
          peak: clip.volume,
        })
      }
      objectFit="cover"
      style={{ width: "100%", height: "100%", opacity }}
    />
  );
};
