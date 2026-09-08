import { describe, expect, it } from "vitest";
import { bandTiming } from "../theme/index.ts";
import { computeBandSpans } from "./band.ts";

const opts = bandTiming;

describe("computeBandSpans", () => {
  it("空なら空配列を返す", () => {
    expect(computeBandSpans([], opts)).toEqual([]);
  });

  it("1 本の line から区間を導く", () => {
    const spans = computeBandSpans([{ start: 1, duration: 2 }], opts);

    expect(spans).toEqual([
      { start: 0.8, duration: 3 + 5 + 0.4 - 0.8, fadeIn: 0.2 },
    ]);
  });

  it("start がフェードイン秒未満なら 0 に clamp し、fadeIn も短縮される", () => {
    const spans = computeBandSpans([{ start: 0.1, duration: 1 }], opts);

    expect(spans[0].start).toBe(0);
    expect(spans[0].fadeIn).toBe(0.1);
  });

  it("start が 0 の line では fadeIn も 0 になる", () => {
    const spans = computeBandSpans([{ start: 0, duration: 1 }], opts);

    expect(spans[0].start).toBe(0);
    expect(spans[0].fadeIn).toBe(0);
  });

  it("次の line との隙間が閾値以内なら 1 区間に統合する", () => {
    // 1 本目: [0, 3)。2 本目: start 8.5。隙間 5.5 <= 閾値 5.6。
    const spans = computeBandSpans(
      [
        { start: 0, duration: 3 },
        { start: 8.5, duration: 1 },
      ],
      opts,
    );

    expect(spans).toHaveLength(1);
  });

  it("隙間 5.4 秒 (閾値 5.6 以内) でも 1 区間に統合する", () => {
    // 1 本目: [0, 3)。2 本目: start 8.4。隙間 5.4 <= 閾値 5.6。
    const spans = computeBandSpans(
      [
        { start: 0, duration: 3 },
        { start: 8.4, duration: 1 },
      ],
      opts,
    );

    expect(spans).toHaveLength(1);
  });

  it("次の line との隙間が閾値を超えると 2 区間に分け、区間同士は重ならない", () => {
    // 1 本目: [0, 3)。2 本目: start 9。隙間 6 > 閾値 5.6。
    const spans = computeBandSpans(
      [
        { start: 0, duration: 3 },
        { start: 9, duration: 1 },
      ],
      opts,
    );

    expect(spans).toHaveLength(2);
    expect(spans[1].start).toBeGreaterThanOrEqual(
      spans[0].start + spans[0].duration,
    );
  });

  it("長い line の中に短い line が入れ子でも区間の終端は長い line 基準になる", () => {
    // 1 本目: [0, 10)。2 本目: [2, 3) は 1 本目に完全に含まれる。
    const spans = computeBandSpans(
      [
        { start: 0, duration: 10 },
        { start: 2, duration: 1 },
      ],
      opts,
    );

    expect(spans).toHaveLength(1);
    expect(spans[0].start + spans[0].duration).toBe(10 + 5.4);
  });

  it("3 グループに分かれる入力では 3 区間になる", () => {
    const spans = computeBandSpans(
      [
        { start: 0, duration: 1 },
        { start: 10, duration: 1 },
        { start: 20, duration: 1 },
      ],
      opts,
    );

    expect(spans).toHaveLength(3);
  });

  it("未ソートの入力でも start 順で扱う", () => {
    const spans = computeBandSpans(
      [
        { start: 8.5, duration: 1 },
        { start: 0, duration: 3 },
      ],
      opts,
    );

    expect(spans).toHaveLength(1);
  });
});
