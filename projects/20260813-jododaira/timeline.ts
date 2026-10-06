// 浄土平 (2026-08-13) の timeline。AviUtl ExEdit2 の project から移行した。

import { staticFile } from "remotion";
import { ryusei } from "../../characters/ryusei.ts";
import {
  audio,
  ending,
  photoShowcase,
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
  start,
  timeline,
} from "../../src/effects/index.ts";

const asset = (path: string) =>
  staticFile(`projects/20260813-jododaira/${path}`);

const clip1 = fade(
  video({
    src: asset("DASHCAM_20260816_133345_466_541(1).mp4"),
    trimBefore: 368.867,
    volume: [
      { at: 0, volume: 0.8 },
      { at: 2, volume: 0.2 },
    ],
  }),
  { at: 0, duration: 50, in: 1.5, out: 2, audio: true },
);

const clip2 = fade(
  video({
    src: asset("DASHCAM_20260816_133345_466_541(1).mp4"),
    trimBefore: 901.802,
    volume: [
      { at: 0, volume: 0.3 },
      { at: 2, volume: 0.1 },
    ],
  }),
  { after: 1, duration: 32, in: 1.5, out: 1, audio: true },
);

const clip3 = fade(
  video({
    src: asset("DASHCAM_20260816_133345_466_541(1).mp4"),
    trimBefore: 2286.369,
    volume: [{ at: 0, volume: 0.1 }],
  }),
  { after: 0, duration: 87, in: 1, out: 1.5, audio: true },
);

const clip4 = fade(
  video({
    src: asset("DASHCAM_20260817_054843_700_729.mp4"),
    trimBefore: 0,
    volume: [
      { at: 0, volume: 1 },
      { at: 10, volume: 0 },
    ],
  }),
  { after: 2, duration: 10, in: 2 },
);

const clip5 = fade(
  video({
    src: asset("DASHCAM_20260817_054843_700_729.mp4"),
    trimBefore: 30.134,
    volume: [{ at: 0, volume: 0.1 }],
  }),
  { after: 0, duration: 7.6, out: 1, audio: true },
);

const clip6 = fade(
  video({
    src: asset("DASHCAM_20260817_054843_700_729.mp4"),
    trimBefore: 92.768,
    volume: [{ at: 0, volume: 0.1 }],
  }),
  { after: 1, duration: 113, in: 0.5 },
);

const clip7 = fade(
  video({
    src: asset("DASHCAM_20260817_064135_748_809.mp4"),
    trimBefore: 995.736,
    volume: [{ at: 0, volume: 0.1 }],
  }),
  { duration: 54, audio: true },
);

// 発話は立ち絵が出る 6 本の区間 (走行中の会話) に分け、それぞれ塊
// (narration()、ADR-0014) にする。各塊は figure() の括りに区間内のすべての
// 行を入れ、立ち絵を出したまま話を続ける。lead・tail・side・in/out は
// AviUtl ExEdit2 の project (移行元) の立ち絵の出入りに合わせた値。各塊は
// 塊の先頭 (0 秒) を、その立ち絵が出始める秒 (lead 分手前) に置くため、
// timeline() の layer では `cut(nK, { at: <立ち絵が出始める秒> })` で置く
// (下の layer 3)。区間の途中で at を使っていた行は、その塊の先頭からの
// 相対秒 (元の絶対秒 − 立ち絵が出始める秒) に書き換えている。
const n1 = await narration([
  figure(ryusei, { side: "left", in: 0.4, out: 0.4, lead: 2, tail: 2 }, [
    cut(
      line({
        text: "取りました",
        by: { character: ryusei, expression: "normal" },
      }),
      { at: 2 },
    ),
    cut(line({ text: "免許を", by: ryusei }), { after: 2 }),
    cut(line({ text: "買いました", by: ryusei }), { after: 2 }),
    cut(line({ text: "バイクも", by: ryusei }), { after: 2 }),
    cut(
      line({
        text: "Honda GB350C です",
        reading: "{Honda|ホンダ} GB350 Cです",
        by: ryusei,
      }),
      { after: 2 },
    ),
    cut(
      line({
        text: "乗りました",
        by: { character: ryusei, expression: "scratch" },
      }),
      { after: 4 },
    ),
    cut(line({ text: "半年くらい", by: ryusei }), { after: 2 }),
    cut(
      line({
        text: "まだ 怖いです",
        by: { character: ryusei, expression: "paleAndSweatBig" },
      }),
      { after: 4 },
    ),
    cut(
      line({
        text: "でも 楽しいです",
        by: {
          character: ryusei,
          expression: "shynessAndScratchAndEyesdownAway",
        },
      }),
      { after: 2 },
    ),
    cut(
      line({
        text: "福島県は 磐梯吾妻スカイラインを走って",
        by: { character: ryusei, expression: "scratch" },
      }),
      { after: 4 },
    ),
    cut(line({ text: "{浄土平|じょうどだいら}に", by: ryusei }), {
      after: 2,
    }),
    cut(
      line({
        text: "行きます",
        by: { character: ryusei, expression: "angry" },
      }),
      { after: 2 },
    ),
  ]),
]);

const n2 = await narration([
  figure(ryusei, { side: "left", in: 0.4, out: 0.4, lead: 2, tail: 2 }, [
    cut(line({ text: "今日は", by: ryusei }), { at: 3 }),
    cut(line({ text: "(2026年)8月は中旬", reading: "8月は中旬", by: ryusei }), {
      after: 1,
    }),
    cut(line({ text: "お盆です", by: ryusei }), { after: 1 }),
    cut(
      line({
        text: "ここは 南ゲート入口(土湯峠側)",
        reading: "ここは 南ゲート入口",
        by: ryusei,
      }),
      { after: 2.5 },
    ),
    cut(line({ text: "磐梯吾妻スカイラインの平均標高は", by: ryusei }), {
      after: 2.5,
    }),
    cut(line({ text: "1350メートル", by: ryusei }), { after: 1.5 }),
    cut(
      line({
        text: "ライディングジャケットを通りぬける風が ちょっとつめたいです",
        by: { character: ryusei, expression: "scratch" },
      }),
      { after: 3 },
    ),
  ]),
]);

const n3 = await narration([
  figure(ryusei, { side: "right", in: 0.4, out: 0.4, lead: 2, tail: 2 }, [
    cut(line({ text: "吾妻の山が みえてきました", by: ryusei }), {
      at: 2,
    }),
    cut(
      line({
        text: "もうすこしで浄土平ビジターセンターです",
        reading: "もうすこしで {浄土平|じょうどだいら} ビジターセンターです",
        by: ryusei,
      }),
      { after: 3 },
    ),
    cut(
      line({
        text: "標高は1600メートル程",
        reading: "標高は 1600メートル程",
        by: { character: ryusei, expression: "scratch" },
      }),
      { after: 3 },
    ),
    cut(
      line({
        text: "吾妻の山々への玄関口になっているほか",
        reading: "吾妻の山々への 玄関口になっているほか",
        by: ryusei,
      }),
      {
        after: 3,
      },
    ),
    cut(
      line({
        text: "日本一標高の高い天文台もあります",
        reading: "日本一 標高の高い天文台も あります",
        by: ryusei,
      }),
      { after: 2.5 },
    ),
    cut(line({ text: "目の前の山は", by: ryusei }), { after: 3 }),
    cut(line({ text: "吾妻小富士", by: ryusei }), { after: 3 }),
    cut(
      line({
        text: "登りました",
        by: { character: ryusei, expression: "normal" },
      }),
      { after: 3 },
    ),
    cut(
      line({
        text: "いい山でした",
        reading: "いい 山でした",
        by: { character: ryusei, expression: "crossed" },
      }),
      {
        after: 4,
      },
    ),
    cut(
      line({
        text: "今夜は泊まります",
        reading: "今夜は 泊まります",
        by: { character: ryusei, expression: "normal" },
      }),
      { after: 5 },
    ),
    cut(line({ text: "{浄土平|じょうどだいら}キャンプ場", by: ryusei }), {
      after: 3,
    }),
    cut(
      line({
        text: "テントを張りました",
        reading: "テントを 張りました",
        by: { character: ryusei, expression: "crossed" },
      }),
      { after: 4 },
    ),
    cut(line({ text: "星空観察と 洒落込むつもりでした", by: ryusei }), {
      after: 2,
    }),
    cut(
      line({
        text: "あいにくの曇りと そして霧",
        by: { character: ryusei, expression: "normal" },
      }),
      {
        after: 3,
      },
    ),
    cut(
      line({ text: "しました", by: { character: ryusei, expression: "bawl" } }),
      { after: 3 },
    ),
    cut(line({ text: "ふて寝を", by: ryusei }), { after: 2 }),
  ]),
]);

const n4 = await narration([
  figure(ryusei, { side: "right", in: 1, out: 1, lead: 1, tail: 1 }, [
    cut(line({ text: "朝", by: ryusei }), { at: 1 }),
    cut(line({ text: "遠くに広がる 朝日に照らされた雲海", by: ryusei }), {
      at: 7,
    }),
    cut(
      line({
        text: "つづら折りのその先に 突っこみたくなるような",
        by: { character: ryusei, expression: "scratchAndEyesdown" },
      }),
      { after: 4 },
    ),
    cut(
      line({
        text: "そんな不思議な眺望です",
        reading: "そんな 不思議な眺望です",
        by: ryusei,
      }),
      {
        after: 2.8,
      },
    ),
  ]),
]);

const n5 = await narration([
  figure(ryusei, { side: "left", in: 1, out: 1, lead: 1, tail: 1 }, [
    cut(
      line({
        text: "荒々しい山肌も相まって",
        by: { character: ryusei, expression: "scratchAndEyesdown" },
      }),
      { at: 1 },
    ),
    cut(line({ text: "およそ この世のものとは思えないような", by: ryusei }), {
      after: 2,
    }),
    cut(
      line({
        text: "そんな景色でした",
        reading: "そんな 景色でした",
        by: {
          character: ryusei,
          expression: "shynessAndScratchAndEyesdownAway",
        },
      }),
      { after: 3 },
    ),
    cut(
      line({
        text:
          "(「火山ガス注意」「窓を閉めて走行下さい」の看板にビビり散らかしている)",
        voice: null,
        by: { character: ryusei, expression: "paleAndSweatBig" },
      }),
      { at: 19.733, duration: 3.167 },
    ),
  ]),
]);

const n6 = await narration([
  figure(ryusei, { side: "left", in: 1, out: 1, lead: 1, tail: 3 }, [
    cut(line({ text: "福島は地元で", by: ryusei }), { at: 2 }),
    cut(
      line({
        text: "実は小さい頃 親の車に連れられ何度か来たことがあります",
        reading: "実は 小さい頃 親の車に連れられ 何度か来たことが あります",
        by: { character: ryusei, expression: "scratch" },
      }),
      { after: 2 },
    ),
    cut(
      line({
        text: "自分のバイクでここに来たのは もちろんはじめてだったのですが",
        by: ryusei,
      }),
      { after: 4 },
    ),
    cut(
      line({
        text: "車窓の景色を眺めるのとは違う 形容しがたいこの感覚に",
        by: { character: ryusei, expression: "scratchAndEyesdown" },
      }),
      { after: 4 },
    ),
    cut(
      line({
        text: "圧倒されてしまいました",
        by: {
          character: ryusei,
          expression: "shynessAndScratchAndEyesdownAway",
        },
      }),
      { after: 3 },
    ),
    cut(
      line({
        text: "まだまだ バイクが楽しい季節です",
        by: { character: ryusei, expression: "scratch" },
      }),
      { after: 3 },
    ),
    cut(line({ text: "行ってみたいものですね", by: ryusei }), {
      after: 4,
    }),
    cut(
      line({
        text: "もっと遠くへ…",
        reading: "もっと 遠くへ",

        by: { character: ryusei, expression: "crossed" },
      }),
      { after: 3 },
    ),
  ]),
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
    crossfade({ duration: 4, audio: true }),
    clip7,
    crossfade({ duration: 1.5, audio: true }),
    fade(
      ending({
        title: "RIDE LOG",
        subtitle: "#1 福島",
        date: {
          from: Temporal.ZonedDateTime.from("2026-08-16T00:00[Asia/Tokyo]"),
          to: Temporal.ZonedDateTime.from("2026-08-17T00:00[Asia/Tokyo]"),
        },
        distance: 213,
        ridingTime: Temporal.Duration.from({ hours: 13, minutes: 37 }),
        routes: [
          "道の駅 ばんだい",
          "道の駅 裏磐梯",
          "浄土平ビジターセンター",
          "浄土平キャンプ場",
        ],
        credits: [
          { ナレーション: "VOICEVOX 青山龍星" },
          { イラスト: "Jacca さま" },
        ],
      }),
      { duration: 5, out: 1 },
    ),
    fade(
      thumbnail({
        photo: asset("photos/PXL_20260815_045406555.RAW-01.jpg"),
        badge: "#1 福島",
        title: "浄土平に\n行く",
        by: ryusei,
      }),
      { after: 0, duration: 5, in: 1 },
    ),
  ],

  // layer 1: 章タイトル・写真紹介・ED
  [
    // GB350C
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260815_045406555.RAW-01.jpg")],
      }),
      { at: start(n1.lines[4]), until: end(n1.lines[4]) },
    ),

    // 浄土平ビジターセンター
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_084122600.RAW-01.MP.jpg")],
      }),
      { at: start(n3.lines[3]), until: end(n3.lines[3]) },
    ),

    // 浄土平天文台
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_055629520.RAW-01.jpg")],
      }),
      { at: start(n3.lines[4]), until: end(n3.lines[4]) },
    ),

    // 吾妻小富士
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_211100736.PANO.jpg")],
      }),
      { at: start(n3.lines[7]), until: end(n3.lines[7], 3) },
    ),

    // テント
    cut(
      photoShowcase({
        photos: [asset("photos/PXL_20260816_092038409.RAW-01.MP.jpg")],
      }),
      { at: start(n3.lines[11]), until: end(n3.lines[11]) },
    ),

    // 星空
    cut(
      photoShowcase({
        photos: [{ video: asset("20260830_013401_425.mp4") }],
        fit: "contain",
      }),
      { at: start(n3.lines[13]), until: end(n3.lines[13], 5) },
    ),
  ],
  // layer 2: BGM
  [
    fade(
      audio({
        src: staticFile("assets/bgm/touring-001.wav"),
        trimBefore: 0,
        volume: [{ at: 0, volume: 0.1 }],
      }),
      { at: start(clip2, -1), duration: 121, in: 0.1, out: 0.2, audio: true },
    ),
    fade(
      audio({
        src: staticFile("assets/bgm/touring-001.wav"),
        trimBefore: 121,
        volume: [
          { at: 0, volume: 0.3 },
          { at: 6, volume: 0.3 },
          { at: 8, volume: 0.1 },
        ],
      }),
      { at: start(clip6, 6), duration: 165, in: 1, out: 0.1, audio: true },
    ),
  ],
  // layer 3: 発話 (立ち絵・暗がり・字幕を持つ塊、6 本)。各塊の先頭を
  // その立ち絵が出始める秒に置く (上のコメント参照)。frame() の黒落ち
  // (layer 4) より下に置くため、立ち絵・字幕も黒落ちの対象になる。
  [
    cut(n1, { at: start(clip1, 2) }),
    cut(n2, { at: start(clip2, 2) }),
    cut(n3, { at: start(clip3, 2) }),
    cut(n4, { at: start(clip6, 14) }),
    cut(n5, { at: start(clip6, 65) }),
    cut(n6, { at: start(clip7, 3) }),
  ],
]);
