// このファイルは scripts/migrate/aup2 が AviUtl ExEdit2 の project ファイル
// (.aup2) から生成した。編集してよいが、再生成すると上書きされる。写像の
// 規則と再生成の手順は scripts/migrate/README.md にある。

import { staticFile } from "remotion";
import { ryusei } from "../../characters/ryusei.ts";
import {
  audio,
  chapterTitle,
  ending,
  photoShowcase,
  subtitle,
  video,
} from "../../src/components/index.tsx";
import {
  figure,
  line,
  narration,
  thumbnail,
} from "../../src/compositions/index.ts";
import {
  crossfade,
  cut,
  end,
  fade,
  frame,
  timeline,
} from "../../src/effects/index.ts";
import {
  chapterTiming,
  chapterTitleDurationSec,
  endingTiming,
  openingTiming,
} from "../../src/theme/index.ts";

const asset = (path: string) =>
  staticFile(`projects/20260813-jododaira/${path}`);

const clip1 = fade(
  video({
    src: asset("DASHCAM_20260816_133345_466_541(1).mp4"),
    trimBefore: 368.867,
    volume: [
      { at: 0, volume: 0 },
      { at: 1.2, volume: 0.15 },
      { at: 47.633, volume: 0.15 },
      { at: 48.633, volume: 0 },
    ],
  }),
  { at: 4.8, duration: 48.633, in: 0.5, out: 0.5 },
);
const clip2 = fade(
  video({
    src: asset("DASHCAM_20260816_133345_466_541(1).mp4"),
    trimBefore: 901.802,
    volume: [
      { at: 0, volume: 0 },
      { at: 3, volume: 0.1 },
      { at: 32.9, volume: 0.1 },
    ],
  }),
  { at: 54.267, duration: 32.9, in: 1.5 },
);
const clip3 = fade(
  video({
    src: asset("DASHCAM_20260816_133345_466_541(1).mp4"),
    trimBefore: 2286.369,
    volume: [
      { at: 0, volume: 0.1 },
      { at: 84.367, volume: 0.1 },
      { at: 87.367, volume: 0 },
    ],
  }),
  { at: 87.167, duration: 87.367, in: 1.5 },
);
const clip4 = fade(
  video({
    src: asset("DASHCAM_20260817_054843_700_729.mp4"),
    trimBefore: 0,
    volume: [
      { at: 0, volume: 1 },
      { at: 9.233, volume: 1 },
      { at: 9.733, volume: 0 },
    ],
  }),
  { at: 175.567, duration: 9.733, in: 2 },
);
const clip5 = fade(
  video({
    src: asset("DASHCAM_20260817_054843_700_729.mp4"),
    trimBefore: 30.134,
    volume: [
      { at: 0, volume: 0.15 },
      { at: 6.6, volume: 0.15 },
      { at: 7.6, volume: 0 },
    ],
  }),
  { at: 185.3, duration: 7.6, out: 1 },
);
const clip6 = fade(
  video({
    src: asset("DASHCAM_20260817_054843_700_729.mp4"),
    trimBefore: 92.768,
    volume: [
      { at: 0, volume: 0 },
      { at: 0.5, volume: 0.15 },
      { at: 112.734, volume: 0.15 },
      { at: 113.234, volume: 0 },
    ],
  }),
  { at: 193.933, duration: 113.234, in: 0.5 },
);
const clip7 = cut(
  video({
    src: asset("DASHCAM_20260817_064135_748_809.mp4"),
    trimBefore: 995.736,
    volume: [
      { at: 0, volume: 0 },
      { at: 1, volume: 0.15 },
      { at: 60.633, volume: 0.15 },
      { at: 62.633, volume: 0 },
    ],
  }),
  { duration: 62.633 },
);

const n = await narration([
  cut(line({ text: "取りました", by: ryusei, expression: "normal" }), {
    at: 8.433,
  }),
  cut(line({ text: "免許を", by: ryusei }), { after: 2.334 }),
  cut(line({ text: "買いました", by: ryusei }), { after: 2.266 }),
  cut(line({ text: "バイクも", by: ryusei }), { after: 2.366 }),
  cut(line({ text: "Honda GB350C です", by: ryusei }), { after: 2.201 }),
  cut(line({ text: "乗りました", by: ryusei }), { after: 3.9 }),
  cut(line({ text: "半年くらい", by: ryusei }), { after: 1.634 }),
  cut(line({ text: "まだ 怖いです", by: ryusei }), { after: 3.233 }),
  cut(line({ text: "でも 楽しいです", by: ryusei }), { after: 1.733 }),
  cut(line({ text: "福島県は 磐梯吾妻スカイラインを走って", by: ryusei }), {
    after: 4.7,
  }),
  cut(line({ text: "浄土平に", by: ryusei }), { after: 2.034 }),
  cut(line({ text: "行きます", by: ryusei }), { after: 1.433 }),
  cut(line({ text: "今日は", by: ryusei }), { at: 61.7 }),
  cut(line({ text: "(2026年)8月は中旬", by: ryusei }), { after: 1.067 }),
  cut(line({ text: "お盆です", by: ryusei }), { after: 1.233 }),
  cut(line({ text: "ここは 南ゲート入口(土湯峠側)", by: ryusei }), {
    after: 2.234,
  }),
  cut(line({ text: "磐梯吾妻スカイラインの平均標高は", by: ryusei }), {
    after: 2.533,
  }),
  cut(line({ text: "1350メートル", by: ryusei }), { after: 1.5 }),
  cut(
    line({
      text: "ライディングジャケットを通りぬける風が ちょっとつめたいです",
      by: ryusei,
    }),
    { after: 2.733 },
  ),
  cut(line({ text: "吾妻の山が みえてきました", by: ryusei }), { at: 90.9 }),
  cut(line({ text: "もうすこしで浄土平ビジターセンターです", by: ryusei }), {
    after: 3.233,
  }),
  cut(line({ text: "標高は1600メートル程", by: ryusei }), { after: 3.066 }),
  cut(line({ text: "吾妻の山々への玄関口になっているほか", by: ryusei }), {
    after: 3.467,
  }),
  cut(line({ text: "日本一標高の高い天文台もあります", by: ryusei }), {
    after: 2.599,
  }),
  cut(line({ text: "目の前の山は", by: ryusei }), { at: 121.9 }),
  cut(line({ text: "吾妻小富士", by: ryusei }), { after: 3.567 }),
  cut(line({ text: "登りました", by: ryusei }), { after: 3.4 }),
  cut(line({ text: "いい山でした", by: ryusei }), { at: 136.767 }),
  cut(line({ text: "今夜は 泊まります", by: ryusei }), { at: 144 }),
  cut(line({ text: "浄土平キャンプ場", by: ryusei }), { after: 2.3 }),
  cut(line({ text: "テントを張りました", by: ryusei }), { after: 3.834 }),
  cut(line({ text: "星空観察と 洒落込むつもりでした", by: ryusei }), {
    after: 2,
  }),
  cut(line({ text: "あいにくの曇りと そして霧", by: ryusei }), {
    after: 3.033,
  }),
  cut(line({ text: "しました", by: ryusei }), { after: 2.434 }),
  cut(line({ text: "ふて寝を", by: ryusei }), { after: 2.833 }),
  cut(line({ text: "朝", by: ryusei }), { at: 209.767 }),
  cut(line({ text: "遠くに広がる 朝日に照らされた雲海", by: ryusei }), {
    at: 215.567,
  }),
  cut(
    line({ text: "つづら折りのその先に 突っこみたくなるような", by: ryusei }),
    { after: 3.933 },
  ),
  cut(line({ text: "そんな 不思議な眺望です", by: ryusei }), { after: 2.8 }),
  cut(line({ text: "荒々しい山肌も相まって", by: ryusei }), { at: 257.367 }),
  cut(line({ text: "およそ この世のものとは思えないような", by: ryusei }), {
    after: 2.199,
  }),
  cut(line({ text: "そんな景色でした", by: ryusei }), { after: 3.2 }),
  cut(
    subtitle({
      text: "(「火山ガス注意」「窓を閉めて走行下さい」の看板にビビり散らかしている)",
    }),
    { at: 275.9, duration: 3.167 },
  ),
  cut(line({ text: "福島は地元で", by: ryusei }), { at: 306.9 }),
  cut(
    line({
      text: "実は小さい頃 親の車に連れられ何度か来たことがあります",
      by: ryusei,
    }),
    { after: 2.233 },
  ),
  cut(
    line({
      text: "自分のバイクでここに来たのは もちろんはじめてだったのですが",
      by: ryusei,
    }),
    { after: 4.034 },
  ),
  cut(
    line({
      text: "車窓の景色を眺めるのとは違う 形容しがたいこの感覚に",
      by: ryusei,
    }),
    { after: 4.4 },
  ),
  cut(line({ text: "圧倒されてしまいました", by: ryusei }), { after: 3.033 }),
  cut(line({ text: "まだまだ バイクが楽しい季節です", by: ryusei }), {
    after: 3.533,
  }),
  cut(line({ text: "行ってみたいものですね", by: ryusei }), { after: 4.7 }),
  cut(line({ text: "もっと遠くへ", by: ryusei }), { after: 4.033 }),
]);

export default timeline([
  // layer 0: 走行映像
  [
    clip1,
    clip2,
    clip3,
    clip4,
    clip5,
    clip6,
    crossfade({ duration: 4.167 }),
    clip7,
  ],
  // layer 1: OP・章タイトル・写真紹介・ED
  [
    cut(
      thumbnail({
        photo: asset("photos/PXL_20260815_045406555.RAW-01.jpg"),
        badge: "",
        title: "",
        character: ryusei,
      }),
      { at: 0, duration: openingTiming.duration },
    ),
    fade(chapterTitle({ title: "", subtitle: "CHAPTER 1" }), {
      at: 5.567,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260815_045406555.RAW-01.jpg")],
      }),
      { at: 19.967, duration: 3.133 },
    ),
    fade(chapterTitle({ title: "", subtitle: "CHAPTER 2" }), {
      at: 58.9,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    fade(chapterTitle({ title: "", subtitle: "CHAPTER 3" }), {
      at: 87.9,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_084122600.RAW-01.MP.jpg")],
      }),
      { at: 107.867, duration: 3.133 },
    ),
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_055629520.RAW-01.jpg")],
      }),
      { at: 113.233, duration: 3.767 },
    ),
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_211100736.PANO.jpg")],
      }),
      { at: 130.8, duration: 3.533 },
    ),
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_092038409.RAW-01.MP.jpg")],
      }),
      { at: 152.867, duration: 1.733 },
    ),
    fade(chapterTitle({ title: "", subtitle: "CHAPTER 4" }), {
      at: 207.133,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    fade(chapterTitle({ title: "", subtitle: "CHAPTER 5" }), {
      at: 254.333,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    fade(chapterTitle({ title: "", subtitle: "CHAPTER 6" }), {
      at: 304.1,
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
    cut(
      ending({
        title: "",
        subtitle: "",
        date: {
          from: Temporal.ZonedDateTime.from("2026-08-16T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-08-17T00:00[Asia/Tokyo]"),
        },
        distance: 0,
        ridingTime: Temporal.Duration.from({ hours: 0, minutes: 0 }),
        routes: [],
        credits: [{ VOICEVOX: "青山龍星" }, { 立ち絵作者: "Jacca" }],
      }),
      {
        at: end(clip7, -endingTiming.duration),
        duration: endingTiming.duration,
      },
    ),
  ],
  // layer 2: 立ち絵
  [
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 6.633, duration: 19.967, in: 0.4 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 26.6, duration: 6.367 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 32.967, duration: 3 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 35.967, duration: 4.233 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 40.2, duration: 9.667 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 49.867, duration: 3.567 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 59.233, duration: 22.467, in: 1 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 81.7, duration: 5.467 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 89.267, duration: 12.767, in: 1 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 102.033, duration: 19.867 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 121.9, duration: 7.267 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 129.167, duration: 7.6 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 136.767, duration: 6.367 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 143.133, duration: 9.733 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 152.867, duration: 6.867 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 159.733, duration: 5.767 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 165.5, duration: 9.033 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 208.667, duration: 13.633, in: 1 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "right" }),
      { at: 222.3, duration: 9.433, out: 1 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 256.167, duration: 5.367, in: 1 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 261.533, duration: 14.367 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 275.9, duration: 4.6, out: 1 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 305.567, duration: 21.5, in: 0.4 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 327.067, duration: 7.3 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 334.367, duration: 5.2 },
    ),
    cut(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 339.567, duration: 7 },
    ),
    fade(
      figure(ryusei, { expression: "normal", speech: n.speech, side: "left" }),
      { at: 346.567, duration: 9.533, out: 1 },
    ),
  ],
  // layer 3: BGM
  [
    cut(
      audio({
        src: staticFile("assets/bgm/m1.wav"),
        trimBefore: 0,
        volume: [
          { at: 0, volume: 0.1 },
          { at: 120.6, volume: 0.1 },
          { at: 121.1, volume: 0 },
        ],
      }),
      { at: 53.433, duration: 121.1 },
    ),
    cut(
      audio({
        src: staticFile("assets/bgm/m1.wav"),
        trimBefore: 121.1,
        volume: [
          { at: 0, volume: 0 },
          { at: 0.5, volume: 0.1 },
          { at: 163.167, volume: 0.1 },
          { at: 165.167, volume: 0 },
        ],
      }),
      { at: 200.467, duration: 165.167 },
    ),
  ],
  // layer 4: 下の layer の合成結果に掛ける黒からの立ち上がり・黒落ち
  [
    fade(frame(), {
      at: 0,
      duration: openingTiming.fadeIn,
      in: openingTiming.fadeIn,
    }),
    fade(frame(), { at: 51.233, duration: 2.2, out: 1 }),
    fade(frame(), { at: 54.267, duration: 2, in: 1 }),
    fade(frame(), { at: 86, duration: 1.167, out: 0.5 }),
    fade(frame(), { at: 173.367, duration: 1.167, out: 0.5 }),
    fade(frame(), { at: 364.267, duration: 1.367, in: 0.667, out: 0.667 }),
  ],
  // layer 5・6: 暗がりと発話 (narration() の戻り値)
  ...n.layers,
]);
