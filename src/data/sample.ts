import type { Timeline } from "../timeline/schema";

// 動作確認用の最小サンプル。素材は public/sample 配下に置く (gitignore 済み)。
export const sampleTimeline: Timeline = {
  meta: {
    width: 1920,
    height: 1080,
    fps: 30,
  },
  clips: [
    {
      src: "sample/clip1.mp4",
      duration: 12,
      sourceFrom: 0,
      volume: 0.3,
      gapBefore: 0,
      crossfadeIn: 0,
    },
  ],
  overlays: [],
  bgm: [
    {
      src: "sample/bgm.wav",
      start: 0,
      duration: 12,
      sourceFrom: 0,
      volume: 0.5,
      fadeIn: 1.2,
      fadeOut: 1.0,
    },
  ],
  lines: [
    {
      id: "line1",
      audio: "sample/line1.wav",
      start: 1,
      duration: 3,
      text: "こんにちは、\nモトブログです。",
      subtitleTail: 0.4,
    },
    {
      id: "line2",
      audio: "sample/line2.wav",
      start: 5,
      duration: 3,
      text: "今日はいい天気ですね。",
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
};
