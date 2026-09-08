import { staticFile } from "remotion";
import {
  annotation,
  chapterTitle,
  thumbnail,
  video,
} from "../../src/components/index.tsx";
import {
  crossfade,
  cut,
  end,
  fade,
  frame,
  start,
  timeline,
} from "../../src/effects/index.ts";
import {
  chapterTiming,
  chapterTitleDurationSec,
  openingTiming,
} from "../../src/theme/timing.ts";

const asset = (path: string) => staticFile(`projects/00000000-sample/${path}`);

const src = asset("VID_20260802_074903_00_287_359_DASHCAM1.mp4");
const a = cut(video({ src }), { duration: 18 });
const b = cut(video({ src, trimBefore: 20 }), { duration: 16.4 });

export default timeline([
  [
    // layer 0: 走行映像
    a,
    crossfade({ duration: 0.4 }),
    b,
  ],
  [
    // layer 1: OP と章タイトル
    // 黒からの立ち上がりは layer 3 の frame() が行うので、ここでは in を付けない
    fade(
      thumbnail({
        photo: asset("photos/photo-03.jpg"),
        badge: "#0 福島 / 磐梯吾妻スカイライン",
        title: "浄土平まで\n走ってきた",
        character: staticFile("assets/characters/4.png"),
      }),
      { duration: openingTiming.duration },
    ),
    fade(chapterTitle({ title: "浄土平へ", subtitle: "CHAPTER 1" }), {
      at: start(b, 0.5),
      duration: chapterTitleDurationSec,
      in: chapterTiming.fade,
      out: chapterTiming.fade,
    }),
  ],
  [
    // layer 2: 注釈
    cut(
      annotation({
        text: "磐梯吾妻スカイラインは11月中旬から冬季閉鎖\n（概要欄にリンク）",
      }),
      { at: 14, duration: 5 },
    ),
  ],
  [
    // layer 3: 下の合成結果を黒から立ち上げ、終端で黒へ落とす
    fade(frame(), { duration: openingTiming.fadeIn, in: openingTiming.fadeIn }),
    fade(frame(), { at: end(b, -2), duration: 2, out: 2 }),
  ],
]);
