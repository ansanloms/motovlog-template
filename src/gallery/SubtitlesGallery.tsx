import React from "react";
import { AbsoluteFill } from "remotion";
import { SubtitleBand } from "../components/SubtitleBand";
import { Subtitles } from "../components/Subtitles";
import { computeBandSpans } from "../timeline/band";
import type { VoicedTimeline } from "../timeline/schema";
import { band } from "../theme";

// SubtitleBand・Subtitles 単体の確認用。timeline を使わず固定 props で描く。
const lines: VoicedTimeline["lines"] = [
  {
    id: "g1",
    start: 1,
    duration: 2,
    text: "今日は浄土平まで走ってきた。",
    subtitleTail: 0.4,
    audio: "",
  },
  {
    id: "g2",
    start: 4,
    duration: 2.5,
    text: "磐梯吾妻スカイラインは、\n紅葉の時期が一番きれいだ。",
    subtitleTail: 0.4,
    audio: "",
  },
];

export const galleryFps = 30;

// lines から導いた暗がりの最後の区間の終端まで表示できる尺にする。
// 区間が無い場合でも Remotion の durationInFrames は 1 以上を要求するため下限を設ける。
const galleryEndSeconds = computeBandSpans(lines, band).reduce(
  (max, span) => Math.max(max, span.start + span.duration),
  0,
);
export const galleryDurationInFrames = Math.max(
  1,
  Math.ceil(galleryEndSeconds * galleryFps),
);

export const SubtitlesGallery: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        // 確認用の背景。上半分を明るい空、下半分を路面に見立てた固定値で、
        // T&M の色ではない。
        background: "linear-gradient(to bottom, #cfe3f0 50%, #6b6b6b 50%)",
      }}
    >
      <SubtitleBand lines={lines} />
      <Subtitles lines={lines} />
    </AbsoluteFill>
  );
};
