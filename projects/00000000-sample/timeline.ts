import { defineTimeline } from "../../src/timeline/schema.ts";

export default defineTimeline({
  meta: {
    width: 1920,
    height: 1080,
    fps: 30,
  },
  // OP とサムネ用フレームの絵。左下に文字、右下に立ち絵が乗るので、左右が
  // 空いた写真を選ぶ。
  opening: {
    photo: "projects/00000000-sample/photos/photo-03.jpg",
    badge: "#0 福島 / 磐梯吾妻スカイライン",
    title: "浄土平まで\n走ってきた",
    character: "assets/characters/4.png",
  },
  // ドラレコの変換済み素材 1 本 (npm run convert で生成)。ED のクロスフェード
  // (0.4 秒) まで映す。
  clips: [
    {
      src: "projects/00000000-sample/VID_20260802_074903_00_287_359_DASHCAM1.mp4",
      duration: 36.4,
      sourceFrom: 0,
      volume: 0.3,
      gapBefore: 0,
      crossfadeIn: 0,
    },
  ],
  overlays: [],
  // BGM は使わない (T&M)。
  bgm: [],
  // セリフ台本。audio・duration は voice.json との合成後に決まる (ADR-0006)。
  lines: [
    {
      id: "line1",
      start: 8,
      text: "今日は浄土平まで走ってきた。",
      subtitleTail: 0.4,
    },
    {
      id: "line2",
      start: 12,
      text: "磐梯吾妻スカイラインは、\n紅葉の時期が一番きれいだ。",
      subtitleTail: 0.4,
    },
  ],
  // 立ち絵。章 1 の後から章 2 まで左、章 2 の後から ED まで右 (T&M: 右へ移すのは章の区切りのみ)。
  characterSegments: [
    { start: 7.4, duration: 12.6, src: "assets/characters/2.png" }, // 7.4 → 20 (章 2 の開始)
    {
      start: 22.4,
      duration: 13.6,
      src: "assets/characters/1.png",
      side: "right",
    }, // 章 2 の後 → 36 (ED)
  ],
  chapters: [
    { start: 5, title: "浄土平へ" },
    { start: 20, title: "スカイラインを下る" },
  ],
  notes: [
    {
      start: 14,
      duration: 5,
      text: "磐梯吾妻スカイラインは11月中旬から冬季閉鎖\n（概要欄にリンク）",
    },
  ],
  // 写真紹介。1 枚 → 2 枚 → 3 枚以上はカットで順送り (要素を続けて並べる)。
  photos: [
    {
      start: 24,
      duration: 3,
      src: ["projects/00000000-sample/photos/photo-01.jpg"],
    },
    {
      start: 27,
      duration: 3,
      src: [
        "projects/00000000-sample/photos/photo-04.jpg",
        "projects/00000000-sample/photos/photo-05.jpg",
      ],
    },
    {
      start: 30,
      duration: 1.5,
      src: ["projects/00000000-sample/photos/photo-02.jpg"],
    },
    {
      start: 31.5,
      duration: 1.5,
      src: ["projects/00000000-sample/photos/photo-05.jpg"],
    },
  ],
  // ED (12 秒) の後にサムネ用フレーム (4.8 秒)。距離・時間・ルートはサンプル用
  // の仮の値。
  ending: {
    start: 36,
    subtitle: "EP.0 / 福島",
    date: {
      from: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
      to: Temporal.ZonedDateTime.from("2026-08-02T00:00[Asia/Tokyo]"),
    },
    distance: 48,
    ridingTime: Temporal.Duration.from({ hours: 1, minutes: 12 }),
    routes: ["福島", "高湯温泉", "浄土平", "土湯峠"],
    credits: [{ VOICEVOX: "青山龍星" }, { 立ち絵: "Jacca さま" }],
  },
});
