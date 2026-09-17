import { describe, expect, it } from "vitest";
import { fps } from "../theme/timing.ts";
import { end, start } from "./anchor.ts";
import { crossfade } from "./crossfade.ts";
import { cut } from "./cut.ts";
import { fade } from "./fade.ts";
import { frame, isFrame } from "./frame.ts";
import { isSample, sample } from "./sample.ts";
import { timeline } from "./timeline.ts";
import type { CutItem, FadeItem } from "./types.ts";

describe("timeline", () => {
  it("位置を省略すると同じ layer の直前の item の終端に連結する", () => {
    const result = timeline([
      [cut(null, { duration: 5 }), cut(null, { duration: 3 })],
    ]);

    expect(result.layers[0][0].at).toBe(0);
    expect(result.layers[0][1].at).toBe(5);
  });

  it("after は直前の item の終端からの相対秒で解決する", () => {
    const result = timeline([
      [cut(null, { duration: 5 }), cut(null, { duration: 3, after: 2 })],
    ]);

    expect(result.layers[0][1].at).toBe(7);
  });

  it("at は絶対秒で解決する", () => {
    const result = timeline([[cut(null, { duration: 5, at: 10 })]]);

    expect(result.layers[0][0].at).toBe(10);
  });

  it("layer 内で item が直前の item と重なると throw する", () => {
    expect(() =>
      timeline([
        [cut(null, { duration: 5 }), cut(null, { duration: 3, at: 2 })],
      ]),
    ).toThrow();
  });

  it("durationSec は layer を跨いだ (at + duration) の最大値", () => {
    const result = timeline([
      [cut(null, { duration: 5 })],
      [fade(null, { duration: 10 })],
    ]);

    expect(result.durationSec).toBe(10);
  });

  it("layers が空なら throw する", () => {
    expect(() => timeline([])).toThrow();
  });

  it("空の layer があれば throw する", () => {
    expect(() => timeline([[]])).toThrow();
  });

  it("fade の in + out が duration を超えるなら throw する", () => {
    expect(() => fade(null, { duration: 1, in: 0.6, out: 0.6 })).toThrow();
  });

  it("fade の in が NaN なら throw する", () => {
    expect(() => fade(null, { duration: 1, in: Number.NaN })).toThrow();
  });

  it("fade の out が負なら throw する", () => {
    expect(() => fade(null, { duration: 1, out: -1 })).toThrow();
  });

  it("at と after を同時に指定すると throw する (cut)", () => {
    const item = {
      kind: "cut",
      node: null,
      duration: 1,
      at: 1,
      after: 1,
    } as unknown as CutItem;

    expect(() => timeline([[item]])).toThrow();
  });

  it("at と after を同時に指定すると throw する (fade)", () => {
    const item = {
      kind: "fade",
      node: null,
      duration: 1,
      in: 0,
      out: 0,
      at: 1,
      after: 1,
    } as unknown as FadeItem;

    expect(() => timeline([[item]])).toThrow();
  });

  it("duration が NaN / 0 / 負なら throw する (cut)", () => {
    expect(() => timeline([[cut(null, { duration: Number.NaN })]])).toThrow();
    expect(() => timeline([[cut(null, { duration: 0 })]])).toThrow();
    expect(() => timeline([[cut(null, { duration: -1 })]])).toThrow();
  });

  it("duration が NaN / 0 / 負なら throw する (fade)", () => {
    expect(() => timeline([[fade(null, { duration: Number.NaN })]])).toThrow();
    expect(() => timeline([[fade(null, { duration: 0 })]])).toThrow();
    expect(() => timeline([[fade(null, { duration: -1 })]])).toThrow();
  });

  it("時間順でない絶対指定は throw する (cut)", () => {
    expect(() =>
      timeline([
        [cut(null, { duration: 5, at: 11 }), cut(null, { duration: 3, at: 0 })],
      ]),
    ).toThrowError(/時間順/);
  });

  it("時間順でない絶対指定は throw する (fade)", () => {
    expect(() =>
      timeline([
        [
          fade(null, { duration: 5, at: 11 }),
          fade(null, { duration: 3, at: 0 }),
        ],
      ]),
    ).toThrowError(/時間順/);
  });

  it("cursor の丸め誤差 (1.1 + 2.2) の直後に at 3.3 を指定しても通る (cut)", () => {
    const result = timeline([
      [
        cut(null, { duration: 1.1 }),
        cut(null, { duration: 2.2 }),
        cut(null, { duration: 1, at: 3.3 }),
      ],
    ]);

    expect(result.layers[0][2].at).toBe(3.3);
  });

  it("cursor の丸め誤差 (1.1 + 2.2) の直後に at 3.3 を指定しても通る (fade)", () => {
    const result = timeline([
      [
        fade(null, { duration: 1.1 }),
        fade(null, { duration: 2.2 }),
        fade(null, { duration: 1, at: 3.3 }),
      ],
    ]);

    expect(result.layers[0][2].at).toBe(3.3);
  });

  it("最初の item の after: 2 は at 2 になる (cut)", () => {
    const result = timeline([[cut(null, { duration: 1, after: 2 })]]);

    expect(result.layers[0][0].at).toBe(2);
  });

  it("最初の item の after: 2 は at 2 になる (fade)", () => {
    const result = timeline([[fade(null, { duration: 1, after: 2 })]]);

    expect(result.layers[0][0].at).toBe(2);
  });

  it("duration が 1 フレーム未満なら throw する", () => {
    expect(() => timeline([[cut(null, { duration: 0.3 / fps })]])).toThrowError(
      /1 フレームに満たない/,
    );
  });

  it("半フレームの item は位置によっては 1 フレームに満たず throw する", () => {
    expect(() =>
      timeline([[cut(null, { duration: 0.5 / fps, at: 0.6 / fps })]]),
    ).toThrowError(/1 フレームに満たない/);
  });

  it("同じ duration でも at: 0 なら throw しない", () => {
    expect(() =>
      timeline([[cut(null, { duration: 0.5 / fps, at: 0 })]]),
    ).not.toThrow();
  });
});

describe("timeline: crossfade", () => {
  it("crossfade の直後の item は直前の終端 − duration から始まり、durationSec が縮む", () => {
    const a = cut(null, { duration: 5 });
    const b = cut(null, { duration: 3 });

    const result = timeline([[a, crossfade({ duration: 0.4 }), b]]);

    expect(result.layers[0][1].at).toBeCloseTo(5 - 0.4);
    expect(result.layers[0][1].transitionIn).toEqual({
      kind: "crossfade",
      duration: 0.4,
    });
    expect(result.durationSec).toBeCloseTo(5 + 3 - 0.4);
  });

  it("layer の先頭に crossfade があると throw する", () => {
    expect(() =>
      timeline([[crossfade({ duration: 0.4 }), cut(null, { duration: 3 })]]),
    ).toThrow();
  });

  it("layer の末尾に crossfade があると throw する", () => {
    expect(() =>
      timeline([[cut(null, { duration: 3 }), crossfade({ duration: 0.4 })]]),
    ).toThrow();
  });

  it("crossfade が連続すると throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: 0.4 }),
          crossfade({ duration: 0.4 }),
          cut(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の直後の item に at/after があると throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: 0.4 }),
          cut(null, { duration: 3, after: 0 }),
        ],
      ]),
    ).toThrow();

    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: 0.4 }),
          cut(null, { duration: 3, at: 10 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の duration が 1 フレーム未満なら throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: 0.01 }),
          cut(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();
  });

  it("境界の差が 0 フレームになる crossfade は遷移側の検査で throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 11.1 / 30 }),
          crossfade({ duration: 0.5 / 30 }),
          cut(null, { duration: 0.5 / 30 }),
        ],
      ]),
    ).toThrow(/crossfade \(index 1\).*1 フレームに満たない/);
  });

  it("秒の丸め誤差で単独区間が短く見えても、フレームでは正当な crossfade は throw しない", () => {
    const result = timeline([
      [
        cut(null, { duration: 1 }),
        crossfade({ duration: 0.1 }),
        cut(null, { duration: 0.3 }),
        crossfade({ duration: 0.2 }),
        cut(null, { duration: 1 }),
      ],
    ]);

    expect(result.layers[0][2].at).toBeCloseTo(1 - 0.1 + 0.3 - 0.2);
  });

  it("crossfade の duration が直前の item より長いと throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 1 }),
          crossfade({ duration: 2 }),
          cut(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の duration が直後の item より長いと throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: 2 }),
          cut(null, { duration: 1 }),
        ],
      ]),
    ).toThrow();
  });

  it("遷移入りの無い直前の item に対し、遷移の尺が半フレーム未満だけ長いと throw する (直後の item の at が負になるのを防ぐ)", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 2 / 30 }),
          crossfade({ duration: 0.07 }),
          cut(null, { duration: 0.1 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade が連続する item を挟むと、遷移入りを引いた単独区間で上限を見る", () => {
    const a = cut(null, { duration: 5 });
    const b = cut(null, { duration: 4 });
    const c = cut(null, { duration: 4 });

    const result = timeline([
      [a, crossfade({ duration: 1 }), b, crossfade({ duration: 2 }), c],
    ]);

    expect(result.layers[0][1].at).toBeCloseTo(4);
    expect(result.layers[0][2].at).toBeCloseTo(6);
    expect(result.durationSec).toBeCloseTo(10);
  });

  it("直前の item の単独区間 (尺 - 自身の遷移入りの尺) より遷移が長いと throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 5 }),
          crossfade({ duration: 3 }),
          cut(null, { duration: 4 }),
          crossfade({ duration: 2 }),
          cut(null, { duration: 4 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の前後どちらかが frame() の item なら throw する", () => {
    expect(() =>
      timeline([
        [cut(null, { duration: 3 })],
        [
          fade(frame(), { duration: 3 }),
          crossfade({ duration: 0.4 }),
          fade(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();

    expect(() =>
      timeline([
        [cut(null, { duration: 3 })],
        [
          fade(null, { duration: 3 }),
          crossfade({ duration: 0.4 }),
          fade(frame(), { duration: 3 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の duration が 0 / 負 / NaN なら throw する", () => {
    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: 0 }),
          cut(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();

    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: -1 }),
          cut(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();

    expect(() =>
      timeline([
        [
          cut(null, { duration: 3 }),
          crossfade({ duration: Number.NaN }),
          cut(null, { duration: 3 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の直前の item が out を持つ fade なら throw する (dissolve と fade-out は排他)", () => {
    expect(() =>
      timeline([
        [
          fade(null, { duration: 5, out: 2 }),
          crossfade({ duration: 0.4 }),
          cut(null, { duration: 5 }),
        ],
      ]),
    ).toThrow();
  });

  it("crossfade の直前の item が out: 0 の fade なら throw しない", () => {
    expect(() =>
      timeline([
        [
          fade(null, { duration: 5, out: 0 }),
          crossfade({ duration: 0.4 }),
          cut(null, { duration: 5 }),
        ],
      ]),
    ).not.toThrow();
  });
});

describe("timeline: frame()", () => {
  it("layer 0 に frame() の item を置くと throw する", () => {
    expect(() => timeline([[fade(frame(), { duration: 1 })]])).toThrow();
  });

  it("cut() に frame() を渡すと throw する", () => {
    expect(() =>
      // @ts-expect-error frame() は cut() に渡せない
      cut(frame(), { duration: 1 }),
    ).toThrow();
  });

  it("layer 1 の fade(frame(), ...) は node が isFrame を満たす", () => {
    const result = timeline([
      [cut(null, { duration: 3 })],
      [fade(frame(), { duration: 1 })],
    ]);

    expect(isFrame(result.layers[1][0].node)).toBe(true);
  });
});

describe("timeline: anchor (start/end)", () => {
  it("下の layer の item を start(item, offset) / end(item, offset) で参照できる", () => {
    const a = cut(null, { duration: 5 });

    const result = timeline([
      [a],
      [
        cut(null, { duration: 1, at: start(a, 0.5) }),
        cut(null, { duration: 1, at: end(a, -2) }),
      ],
    ]);

    expect(result.layers[1][0].at).toBeCloseTo(0.5);
    expect(result.layers[1][1].at).toBeCloseTo(3);
  });

  it("同じ layer の前の item を start() で参照できる", () => {
    const a = cut(null, { duration: 1 });

    const result = timeline([
      [a, cut(null, { duration: 1, at: start(a, 1.5) })],
    ]);

    expect(result.layers[0][1].at).toBeCloseTo(1.5);
  });

  it("上の layer の item を start() で参照できる (依存順に解決する)", () => {
    const upper = cut(null, { duration: 1 });

    const result = timeline([
      [cut(null, { duration: 1, at: start(upper, 0.5) })],
      [upper],
    ]);

    expect(result.layers[1][0].at).toBe(0);
    expect(result.layers[0][0].at).toBeCloseTo(0.5);
  });

  it("同じ layer の後ろの item を参照すると throw する (自己循環)", () => {
    const later = cut(null, { duration: 1 });

    expect(() =>
      timeline([[cut(null, { duration: 1, at: start(later, 0) }), later]]),
    ).toThrow(/参照先を解決できません/);
  });

  it("どの layer にも置いていない item を参照すると throw する", () => {
    const orphan = cut(null, { duration: 1 });

    expect(() =>
      timeline([[cut(null, { duration: 1, at: start(orphan, 0) })]]),
    ).toThrow(/参照先を解決できません/);
  });

  it("2 つの layer が互いを参照する (循環) と throw する", () => {
    const a = { kind: "cut", node: null, duration: 1 } as unknown as CutItem;
    const b = { kind: "cut", node: null, duration: 1 } as unknown as CutItem;

    (a as { at?: unknown }).at = start(b, 0);
    (b as { at?: unknown }).at = start(a, 0);

    expect(() => timeline([[a], [b]])).toThrow(/参照先を解決できません/);
  });

  it("layer がブロックされても、手前で確定した item は他の layer から参照できる (真の循環ではない)", () => {
    const a0 = cut(null, { duration: 1, at: 0 });
    const b0 = cut(null, { duration: 1, at: start(a0, 2) });
    const a1 = cut(null, { duration: 1, at: end(b0, 1) });

    const result = timeline([[a0, a1], [b0]]);

    expect(result.layers[1][0].at).toBeCloseTo(2);
    expect(result.layers[0][1].at).toBeCloseTo(4);
  });

  it("一部の item が確定しても、残りが真に循環していれば throw する", () => {
    const a0 = cut(null, { duration: 1 });
    const b0 = { kind: "cut", node: null, duration: 1 } as unknown as CutItem;
    const a1 = { kind: "cut", node: null, duration: 1 } as unknown as CutItem;

    (b0 as { at?: unknown }).at = start(a1, 0);
    (a1 as { at?: unknown }).at = start(b0, 0);

    expect(() => timeline([[a0, a1], [b0]])).toThrow(/参照先を解決できません/);
  });

  it("3 つの layer をまたぐ連鎖を配列順とは異なる順で解決しても、layers は元の配列順のまま", () => {
    const c = cut(null, { duration: 2 });
    const a = cut(null, { duration: 1, at: start(c, 1) });
    const b = cut(null, { duration: 1, at: start(a, 0.5) });

    const result = timeline([[a], [b], [c]]);

    expect(result.layers[2][0].at).toBeCloseTo(0);
    expect(result.layers[0][0].at).toBeCloseTo(1);
    expect(result.layers[1][0].at).toBeCloseTo(1.5);
  });

  it("同じ item オブジェクトを 2 つの layer に置くと throw する", () => {
    const shared = cut(null, { duration: 1 });

    expect(() => timeline([[shared], [shared]])).toThrow();
  });

  it("crossfade で縮んだ後の end(b) を参照すると縮んだ終端になる", () => {
    const a = cut(null, { duration: 5 });
    const b = cut(null, { duration: 3 });

    const result = timeline([
      [a, crossfade({ duration: 0.4 }), b],
      [cut(null, { duration: 1, at: end(b, 0) })],
    ]);

    const bResolved = result.layers[0][1];

    expect(result.layers[1][0].at).toBeCloseTo(
      bResolved.at + bResolved.duration,
    );
    expect(result.layers[1][0].at).toBeCloseTo(5 + 3 - 0.4);
  });

  it("アンカーで解決した値が直前の終端より前になると時間順の検査で throw する", () => {
    const a = cut(null, { duration: 1 });

    expect(() =>
      timeline([
        [a],
        [
          cut(null, { duration: 1, at: 5 }),
          cut(null, { duration: 1, at: start(a, 0) }),
        ],
      ]),
    ).toThrow();
  });

  it("start(item, NaN) は throw する", () => {
    const a = cut(null, { duration: 1 });

    expect(() => start(a, Number.NaN)).toThrow();
  });

  it("item の source を登録し、start()/end() で元の item を参照できる", () => {
    const original = cut(null, { duration: 1 });
    const wrapped: CutItem = {
      ...cut(null, { duration: 3 }),
      source: original,
    };

    const result = timeline([
      [wrapped],
      [cut(null, { duration: 1, at: start(original, 0.5) })],
    ]);

    expect(result.layers[1][0].at).toBeCloseTo(0.5);
  });

  it("解決済み item は source を持たない (narration() の入力 item への参照は Stage に渡さない)", () => {
    const original = cut(null, { duration: 1 });
    const wrapped: CutItem = {
      ...cut(null, { duration: 3 }),
      source: original,
    };

    const result = timeline([[wrapped]]);

    expect(result.layers[0][0]).not.toHaveProperty("source");
  });

  it("同じ source を持つ item が 2 つあると throw する", () => {
    const original = cut(null, { duration: 1 });
    const a: CutItem = { ...cut(null, { duration: 1 }), source: original };
    const b: CutItem = {
      ...cut(null, { duration: 1, after: 0 }),
      source: original,
    };

    expect(() => timeline([[a, b]])).toThrow();
  });
});

describe("timeline: until", () => {
  it("until: number は開始位置解決後に duration = until − start を求める", () => {
    const result = timeline([
      [cut(null, { duration: 2, at: 1 }), cut(null, { until: 5, after: 0 })],
    ]);

    expect(result.layers[0][1].at).toBeCloseTo(3);
    expect(result.layers[0][1].duration).toBeCloseTo(2);
  });

  it("until: Anchor は別 layer の item の終端 (end()) を基準に duration を求める", () => {
    const a = cut(null, { duration: 5 });

    const result = timeline([[a], [cut(null, { at: 0, until: end(a, -1) })]]);

    expect(result.layers[1][0].at).toBe(0);
    expect(result.layers[1][0].duration).toBeCloseTo(4);
  });

  it("until が start より前だと 1 フレームに満たない検査で throw する", () => {
    expect(() => timeline([[cut(null, { at: 5, until: 4 })]])).toThrowError(
      /1 フレームに満たない/,
    );
  });

  it("cut() に duration と until を両方指定すると throw する", () => {
    const options = { duration: 1, until: 2 } as unknown as Parameters<
      typeof cut
    >[1];

    expect(() => cut(null, options)).toThrow(
      /duration と until は同時に指定できません/,
    );
  });

  it("fade() に duration と until を両方指定すると throw する", () => {
    const options = { duration: 1, until: 2 } as unknown as Parameters<
      typeof fade
    >[1];

    expect(() => fade(null, options)).toThrow(
      /duration と until は同時に指定できません/,
    );
  });

  it("duration と until を両方持つ生の item を layer に置くと throw する (cut()/fade() を経由しない object literal)", () => {
    const item = {
      kind: "cut",
      node: null,
      duration: 1,
      until: 2,
    } as unknown as CutItem;

    expect(() => timeline([[item]])).toThrowError(
      /duration と until を同時に指定できません/,
    );
  });

  it("duration も until も無い item (leak した PendingCutItem 等) を layer に置くと throw する", () => {
    const pending = cut(null, { at: 8.5 });

    expect(() => timeline([[pending as unknown as CutItem]])).toThrowError(
      /duration か until のどちらかが必要です/,
    );
  });

  it("fade() の until 指定で in + out が解決後の duration を超えると throw する", () => {
    expect(() =>
      timeline([[fade(null, { at: 0, until: 1, in: 0.6, out: 0.6 })]]),
    ).toThrowError(/in \(.*\) \+ out \(.*\) が until から求めた duration/);
  });
});

describe("timeline: sample()", () => {
  it("cut(sample(...), ...) の node は isSample を満たす", () => {
    const render = (): null => null;

    const result = timeline([[cut(sample(render), { duration: 1 })]]);

    expect(isSample(result.layers[0][0].node)).toBe(true);
  });

  it("fade(sample(...), ...) の node は isSample を満たす", () => {
    const render = (): null => null;

    const result = timeline([[fade(sample(render), { duration: 1, in: 0.5 })]]);

    expect(isSample(result.layers[0][0].node)).toBe(true);
  });
});
