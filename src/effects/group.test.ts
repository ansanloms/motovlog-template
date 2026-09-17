import { describe, expect, it } from "vitest";
import { end, start } from "./anchor.ts";
import { crossfade } from "./crossfade.ts";
import { cut } from "./cut.ts";
import { fade } from "./fade.ts";
import { frame } from "./frame.ts";
import { group, isGroup } from "./group.ts";
import { timeline } from "./timeline.ts";
import type { CutItem } from "./types.ts";

describe("group()", () => {
  it("layers が空なら throw する", () => {
    expect(() => group([])).toThrow();
  });

  it("空の layer があれば throw する", () => {
    expect(() => group([[]])).toThrow();
  });

  it("戻り値は isGroup を満たす", () => {
    expect(isGroup(group([[cut(null, { duration: 1 })]]))).toBe(true);
  });

  it("isGroup はそれ以外の値を false にする", () => {
    expect(isGroup(null)).toBe(false);
    expect(isGroup({ kind: "frame" })).toBe(false);
  });
});

describe("timeline: 塊 (group)", () => {
  it("塊は at で置き、内部の at は塊の先頭からの相対秒になる", () => {
    const g = group([[cut(null, { duration: 1, at: 1 })]]);

    const result = timeline([[cut(g, { at: 5, duration: 3 })]]);

    const outer = result.layers[0][0];

    expect(outer.at).toBe(5);
    expect(outer.group?.layers[0][0].at).toBeCloseTo(6);
  });

  it("塊の中の after は塊の先頭からの相対カーソルで連結する", () => {
    const g = group([
      [cut(null, { duration: 1 }), cut(null, { duration: 1, after: 0.5 })],
    ]);

    const result = timeline([[cut(g, { at: 2, duration: 5 })]]);

    const inner = result.layers[0][0].group?.layers[0];

    expect(inner?.[0].at).toBeCloseTo(2);
    expect(inner?.[1].at).toBeCloseTo(2 + 1 + 0.5);
  });

  it("duration/until を省くと内部の item の終端の最大値が塊の尺になる", () => {
    const g = group([
      [cut(null, { duration: 2, at: 0 })],
      [cut(null, { duration: 1, at: 3 })],
    ]);

    const outer = cut(g, { at: 0 });
    const result = timeline([[outer]]);

    expect(result.layers[0][0].duration).toBeCloseTo(4);
  });

  it("fade(group(...), { at, in }) も duration/until を省略できる (内容の尺になる)", () => {
    const g = group([[cut(null, { duration: 2, at: 0 })]]);

    const result = timeline([[fade(g, { at: 0, in: 0.5 })]]);

    expect(result.layers[0][0].kind).toBe("fade");
    expect(result.layers[0][0].duration).toBeCloseTo(2);
  });

  it("明示した duration が内部の内容より短いと throw する", () => {
    const g = group([[cut(null, { duration: 5, at: 0 })]]);

    expect(() => timeline([[cut(g, { at: 0, duration: 3 })]])).toThrowError(
      /塊の中の item が塊の尺を超えています/,
    );
  });

  it("明示した duration が内部の内容より長くても通り、end() は明示した尺の終端になる", () => {
    const g = group([[cut(null, { duration: 2, at: 0 })]]);
    const groupItem = cut(g, { at: 1, duration: 10 });

    const result = timeline([
      [groupItem],
      [cut(null, { duration: 1, at: end(groupItem, 0) })],
    ]);

    expect(result.layers[1][0].at).toBeCloseTo(11);
  });

  it("until を指定すると開始位置の解決後に duration を求める", () => {
    const g = group([[cut(null, { duration: 2, at: 0 })]]);

    const result = timeline([[cut(g, { at: 1, until: 6 })]]);

    expect(result.layers[0][0].duration).toBeCloseTo(5);
  });

  it("塊の外から start()/end() で塊の中の item を参照できる", () => {
    const inner = cut(null, { duration: 2, at: 1 });
    const g = group([[inner]]);
    const groupItem = cut(g, { at: 5, duration: 10 });

    const result = timeline([
      [groupItem],
      [cut(null, { duration: 1, at: start(inner, 0) })],
      [cut(null, { duration: 1, at: end(inner, 0) })],
    ]);

    expect(result.layers[1][0].at).toBeCloseTo(6);
    expect(result.layers[2][0].at).toBeCloseTo(8);
  });

  it("塊の中の item が塊の外の item を参照すると throw する", () => {
    const outer = cut(null, { duration: 1, at: 0 });
    const g = group([[cut(null, { duration: 1, at: start(outer, 0) })]]);

    expect(() => timeline([[outer], [cut(g, { at: 5, duration: 5 })]])).toThrow(
      /塊の外の item を参照できません/,
    );
  });

  it("塊の中に frame() を置くと throw する", () => {
    const g = group([
      [cut(null, { duration: 1 })],
      [fade(frame(), { duration: 1 })],
    ]);

    expect(() => timeline([[cut(g, { at: 0, duration: 5 })]])).toThrow(
      /塊の中に frame\(\) は置けません/,
    );
  });

  it("塊は入れ子にでき、2 段目の絶対秒も正しく解決する", () => {
    const innerMost = cut(null, { duration: 1, at: 0 });
    const inner = group([[innerMost]]);
    const outer = group([[cut(inner, { at: 2, duration: 3 })]]);

    const result = timeline([[cut(outer, { at: 10, duration: 20 })]]);

    const outerItem = result.layers[0][0];
    const innerGroupItem = outerItem.group?.layers[0][0];
    const innerMostResolved = innerGroupItem?.group?.layers[0][0];

    expect(innerGroupItem?.at).toBeCloseTo(12);
    expect(innerMostResolved?.at).toBeCloseTo(12);
  });

  it("塊の中の at が負だと throw する (塊の先頭より前)", () => {
    const g = group([[cut(null, { duration: 1, at: -1 })]]);

    expect(() => timeline([[cut(g, { at: 0, duration: 5 })]])).toThrow(
      /塊の先頭/,
    );
  });

  it("塊の中の item の source は絶対秒で登録され、塊の外から参照できる", () => {
    const original = cut(null, { duration: 1 });
    const wrapped: CutItem = {
      ...cut(null, { duration: 3, at: 0 }),
      source: original,
    };
    const g = group([[wrapped]]);

    const result = timeline([
      [cut(g, { at: 4, duration: 10 })],
      [cut(null, { duration: 1, at: start(original, 0.5) })],
    ]);

    expect(result.layers[1][0].at).toBeCloseTo(4.5);
  });

  it("塊の item どうしも crossfade で繋げる", () => {
    const g1 = group([[cut(null, { duration: 2, at: 0 })]]);
    const g2 = group([[cut(null, { duration: 2, at: 0 })]]);
    const a = cut(g1, { duration: 5 });
    const b = cut(g2, { duration: 3 });

    const result = timeline([[a, crossfade({ duration: 0.4 }), b]]);

    expect(result.layers[0][1].at).toBeCloseTo(5 - 0.4);
    expect(result.layers[0][1].transitionIn).toEqual({
      kind: "crossfade",
      duration: 0.4,
    });
  });

  it("durationSec は塊の item も outer の at + duration で数える", () => {
    const g = group([[cut(null, { duration: 2, at: 0 })]]);

    const result = timeline([[cut(g, { at: 0, duration: 5 })]]);

    expect(result.durationSec).toBe(5);
  });

  it("塊の item の until が別 layer の item を参照していても、再試行で内部 item の重複エラーにならない", () => {
    const other = cut(null, { duration: 3, at: 10 });
    const g = group([[cut(null, { duration: 2, at: 0 })]]);

    const result = timeline([
      [cut(g, { at: 0, until: end(other, 0) })],
      [other],
    ]);

    expect(result.layers[0][0].duration).toBeCloseTo(13);
  });

  it("入れ子の塊は塊ごとに membership を作り直し、内側の塊の item は外側の塊の item を参照できない (layer 順に関わらず)", () => {
    const makeTimeline = (innerFirst: boolean) => {
      const outerItem = cut(null, { duration: 1, at: 0 });
      const innerItem = cut(null, { duration: 1, at: start(outerItem, 0) });
      const inner = group([[innerItem]]);
      const innerWrapper = cut(inner, { at: 0, duration: 5 });
      const outer = group(
        innerFirst
          ? [[innerWrapper], [outerItem]]
          : [[outerItem], [innerWrapper]],
      );

      return timeline([[cut(outer, { at: 0, duration: 20 })]]);
    };

    expect(() => makeTimeline(false)).toThrow(
      /塊の中の item は塊の外の item を参照できません/,
    );
    expect(() => makeTimeline(true)).toThrow(
      /塊の中の item は塊の外の item を参照できません/,
    );
  });

  it("塊の中の item の source へのアンカーは、同じ塊の中からも参照できる", () => {
    const original = cut(null, { duration: 1 });
    const wrapped: CutItem = {
      ...cut(null, { duration: 3, at: 0 }),
      source: original,
    };
    const g = group([
      [wrapped],
      [cut(null, { duration: 1, at: start(original, 0.5) })],
    ]);

    const result = timeline([[cut(g, { at: 4, duration: 10 })]]);

    expect(result.layers[0][0].group?.layers[1][0].at).toBeCloseTo(4.5);
  });
});
