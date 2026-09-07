import { defineTimeline } from "../../src/timeline/schema";

export default defineTimeline({
  meta: {
    width: 1920,
    height: 1080,
    fps: 30,
  },
  // ドラレコの変換済み素材 1 本 (scripts/convert-movie.sh で生成)。
  clips: [
    {
      src: "projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4",
      duration: 12,
      sourceFrom: 0,
      volume: 0.3,
      gapBefore: 0,
      crossfadeIn: 0,
    },
  ],
  overlays: [],
  // BGM (common assets)。
  bgm: [
    {
      src: "assets/bgm/m1.wav",
      start: 0,
      duration: 12,
      sourceFrom: 0,
      volume: 0.5,
      fadeIn: 1.2,
      fadeOut: 1.0,
    },
  ],
  // セリフ台本。audio・duration は voice.json との合成後に決まる (ADR-0006)。
  lines: [
    {
      id: "line1",
      start: 1,
      text: "今日は浄土平まで走ってきた。",
      subtitleTail: 0.4,
    },
    {
      id: "line2",
      start: 4,
      text: "磐梯吾妻スカイラインは、\n紅葉の時期が一番きれいだ。",
      subtitleTail: 0.4,
    },
  ],
  subtitleBands: [
    {
      start: 1,
      duration: 7.4,
      fadeIn: 0.5,
      fadeOut: 0.5,
    },
  ],
  characterSegments: [],
  // 暗転 + クレジット。
  ending: {
    fadeToBlackStart: 10,
    fadeDuration: 2,
    credits: {
      text: "ご視聴ありがとうございました",
      start: 10,
      duration: 2,
    },
  },
  style: {
    subtitle: {
      fontSize: 40,
      color: "#ffffff",
      letterSpacing: 2,
      bottomOffset: 120,
    },
    band: {
      color: "#262672",
      opacity: 0.8,
      height: 160,
    },
  },
});
