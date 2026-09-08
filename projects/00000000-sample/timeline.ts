import { staticFile } from "remotion";
import {
  annotation,
  chapterTitle,
  thumbnail,
  video,
} from "../../src/components/index.tsx";
import { cut, fade, timeline } from "../../src/effects/index.ts";
import {
  chapterTiming,
  chapterTitleDurationSec,
  openingTiming,
} from "../../src/theme/timing.ts";

const asset = (path: string) => staticFile(`projects/00000000-sample/${path}`);

export default timeline([
  [
    // layer 0: 走行映像
    cut(video({ src: asset("VID_20260802_074903_00_287_359_DASHCAM1.mp4") }), {
      duration: 36.4,
    }),
  ],
  [
    // layer 1: OP と章タイトル
    fade(
      thumbnail({
        photo: asset("photos/photo-03.jpg"),
        badge: "#0 福島 / 磐梯吾妻スカイライン",
        title: "浄土平まで\n走ってきた",
        character: staticFile("assets/characters/4.png"),
      }),
      { duration: openingTiming.duration, in: openingTiming.fadeIn },
    ),
    fade(chapterTitle({ title: "浄土平へ", subtitle: "CHAPTER 1" }), {
      after: 0.2,
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
]);
