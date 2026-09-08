import { describe, expect, it } from "vitest";
import { bandTiming, subtitleTiming } from "../theme/index.ts";
import { computeBandSpans } from "./band.ts";

const opts = bandTiming;

/** 通常の発話 1 本を { start, speechEnd, captionEnd } に変換する (captionEnd = start + duration + tail)。 */
const line = (start: number, duration: number) => ({
  start,
  speechEnd: start + duration,
  captionEnd: start + duration + subtitleTiming.tail,
});

describe("computeBandSpans", () => {
  it("空なら空配列を返す", () => {
    expect(computeBandSpans([], opts)).toEqual([]);
  });

  it("1 本の line から区間を導く", () => {
    const spans = computeBandSpans([line(1, 2)], opts);

    expect(spans).toEqual([
      {
        start: 0.8,
        duration: 3 + subtitleTiming.tail + bandTiming.fadeOut - 0.8,
        fadeIn: 0.2,
      },
    ]);
  });

  it("start がフェードイン秒未満なら 0 に clamp し、fadeIn も短縮される", () => {
    const spans = computeBandSpans([line(0.1, 1)], opts);

    expect(spans[0].start).toBe(0);
    expect(spans[0].fadeIn).toBe(0.1);
  });

  it("start が 0 の line では fadeIn も 0 になる", () => {
    const spans = computeBandSpans([line(0, 1)], opts);

    expect(spans[0].start).toBe(0);
    expect(spans[0].fadeIn).toBe(0);
  });

  it("次の line との隙間 (speechEnd 基準) が silenceGap (5) 以内なら 1 区間に統合する", () => {
    // 1 本目: speechEnd 3。2 本目: start 7.9。隙間 4.9 <= silenceGap 5。
    const spans = computeBandSpans([line(0, 3), line(7.9, 1)], opts);

    expect(spans).toHaveLength(1);
  });

  it("隙間がちょうど silenceGap (5) でも 1 区間に統合する (境界)", () => {
    // 1 本目: speechEnd 3。2 本目: start 8。隙間 5 (境界)。
    const spans = computeBandSpans([line(0, 3), line(8, 1)], opts);

    expect(spans).toHaveLength(1);
  });

  it("隙間が silenceGap (5) を 0.01 秒超えると 2 区間に分かれる", () => {
    // 1 本目: speechEnd 3、captionEnd 3.4。2 本目: start 8.01。隙間 5.01。
    // 重なり判定 (3.4 + 0.4 = 3.8 > 8.01 - 0.2 = 7.81) も成立しないので分かれる。
    const spans = computeBandSpans([line(0, 3), line(8.01, 1)], opts);

    expect(spans).toHaveLength(2);
  });

  it("次の line との隙間が silenceGap を超えると 2 区間に分け、区間同士は重ならない", () => {
    // 1 本目: speechEnd 3。2 本目: start 10。隙間 7 > silenceGap 5。
    const spans = computeBandSpans([line(0, 3), line(10, 1)], opts);

    expect(spans).toHaveLength(2);
    expect(spans[1].start).toBeGreaterThanOrEqual(
      spans[0].start + spans[0].duration,
    );
  });

  it("区間の終端は captionEnd の最大 + fadeOut になる", () => {
    const spans = computeBandSpans([line(0, 3)], opts);

    expect(spans[0].start + spans[0].duration).toBe(
      3 + subtitleTiming.tail + bandTiming.fadeOut,
    );
  });

  it("最後のグループも同じ規則で終端を求める (保持しない)", () => {
    const spans = computeBandSpans([line(0, 1), line(10, 1)], opts);

    expect(spans[1].start + spans[1].duration).toBe(
      11 + subtitleTiming.tail + bandTiming.fadeOut,
    );
  });

  it("長い line の中に短い line が入れ子でも区間の終端は長い line 基準になる", () => {
    // 1 本目: [0, 10)。2 本目: [2, 3) は 1 本目に完全に含まれる。
    const spans = computeBandSpans([line(0, 10), line(2, 1)], opts);

    expect(spans).toHaveLength(1);
    expect(spans[0].start + spans[0].duration).toBe(
      10 + subtitleTiming.tail + bandTiming.fadeOut,
    );
  });

  it("3 グループに分かれる入力では 3 区間になる", () => {
    const spans = computeBandSpans(
      [line(0, 1), line(10, 1), line(20, 1)],
      opts,
    );

    expect(spans).toHaveLength(3);
  });

  it("未ソートの入力でも start 順で扱う", () => {
    const spans = computeBandSpans([line(7.9, 1), line(0, 3)], opts);

    expect(spans).toHaveLength(1);
  });

  it("閾値ぎりぎりで分けると重なるケースは、重なり判定 (prev.captionEnd + fadeOut > 次の start - leadIn) で 1 区間に繋がれる", () => {
    // 1 本目: start 1、speechEnd 2、captionEnd 8 (duration を明示して字幕を
    // 長く出した line() を想定)。2 本目: start 8、speechEnd 9。
    // 隙間 (speechEnd 基準) は 8 - 2 = 6 > silenceGap 5 で本来なら分かれるが、
    // 分けると 1 本目の captionEnd + fadeOut (8.4) が 2 本目の区間の開始
    // (8 - leadIn = 7.8) を超えて重なってしまうため、1 区間に繋げる。
    const spans = computeBandSpans(
      [
        { start: 1, speechEnd: 2, captionEnd: 8 },
        { start: 8, speechEnd: 9, captionEnd: 9.4 },
      ],
      opts,
    );

    expect(spans).toHaveLength(1);
    expect(spans[0].start + spans[0].duration).toBe(9.4 + bandTiming.fadeOut);
  });

  it("silenceGap 0 の opts では、直前 1 本ではなくグループの running max で統合判定するため throw せず 1 区間に統合される", () => {
    // L1: start 0、captionEnd 20 (duration を明示した長い字幕を想定)。
    // L2: start 1、speechEnd 2、captionEnd 2.4 は L1 に隙間 0 <= silenceGap 0
    // で統合される (グループの captionEnd の running max は 20 のまま)。
    // L3: start 10 は「直前」の L2 (speechEnd 2、captionEnd 2.4) とだけ
    // 比べれば隙間 8 > silenceGap 0 で分割されそうだが、グループの running
    // max (captionEnd 20) との重なり判定 (20 + 0.4 > 10 - leadIn) が成立し、
    // 1 区間に統合される。
    const bad = { leadIn: 0.2, silenceGap: 0, fadeOut: 0.4 };

    const spans = computeBandSpans(
      [
        { start: 0, speechEnd: 1, captionEnd: 20 },
        { start: 1, speechEnd: 2, captionEnd: 2.4 },
        { start: 10, speechEnd: 11, captionEnd: 11.4 },
      ],
      bad,
    );

    expect(spans).toHaveLength(1);
  });

  it("長い字幕の line を挟んでも running max で判定するため、グループ化を誤らない (reviewer 再現ケース 1)", () => {
    // L1: start 10、speechEnd 12、captionEnd 30 (duration を明示した長い
    // 字幕を想定)。L2: start 12 は L1 に統合され、グループの captionEnd の
    // running max は 30 のまま保持される。L3: start 20 は「直前」の L2
    // (speechEnd 13、captionEnd 13.4) とだけ比べると隙間 7 > silenceGap 5 で
    // 分割されてしまうが、running max (speechEnd 12、captionEnd 30) と
    // 比べれば重なり判定 (30 + 0.4 > 20 - 0.2) が成立し、1 区間に統合される。
    const spans = computeBandSpans(
      [
        { start: 10, speechEnd: 12, captionEnd: 30 },
        { start: 12, speechEnd: 13, captionEnd: 13.4 },
        { start: 20, speechEnd: 22, captionEnd: 22.4 },
      ],
      opts,
    );

    expect(spans).toEqual([
      {
        start: 9.8,
        duration: 30 + bandTiming.fadeOut - 9.8,
        fadeIn: 0.2,
      },
    ]);
  });

  it("無音が silenceGap 以内でも、直前 1 本の speechEnd で測ると一旦消えてしまうケースは running max で 1 区間に統合される (reviewer 再現ケース 2)", () => {
    // L1: start 0、speechEnd 18、captionEnd 20 (duration を明示した長い
    // 字幕を想定)。L2: start 1 は L1 に統合され、グループの speechEnd の
    // running max は 18 のまま保持される。L3: start 22 は「直前」の L2
    // (speechEnd 1.5) とだけ比べると隙間 20.5 > silenceGap 5 で分割されて
    // しまうが、running max (speechEnd 18) と比べれば隙間 4 <= silenceGap 5
    // が成立し、1 区間に統合される。
    const spans = computeBandSpans(
      [
        { start: 0, speechEnd: 18, captionEnd: 20 },
        { start: 1, speechEnd: 1.5, captionEnd: 1.9 },
        { start: 22, speechEnd: 23, captionEnd: 23.4 },
      ],
      opts,
    );

    expect(spans).toHaveLength(1);
  });
});
