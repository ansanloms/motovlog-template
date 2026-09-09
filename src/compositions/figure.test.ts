import { isValidElement } from "react";
import { staticFile } from "remotion";
import { describe, expect, it } from "vitest";
import { character } from "./character.ts";
import type { Character } from "./character.ts";
import { Figure } from "../components/Figure.tsx";
import { isSample } from "../effects/index.ts";
import { fps } from "../theme/timing.ts";
import type { LipsyncEntry } from "../voice/cache.ts";
import {
  expressionAt,
  figure,
  isBlinking,
  layerSources,
  mouthAt,
} from "./figure.ts";
import type { MouthKey } from "./figure.ts";
import type { Speech } from "./narration.ts";

// 発話 1 本分の口パクデータ (ADR-0011)。0.1〜0.3 が "a"、0.3〜0.35 が促音の
// 無音 ("cl"、直前の "a" を維持)、0.35〜0.55 が "i"、0.55〜0.6 が撥音
// ("N" → "n")、0.6〜0.7 は子音の隙間 (entry 無し、直前の "N" → "n" を
// 維持)、0.7〜0.9 が "u"。
const entriesA: readonly LipsyncEntry[] = [
  { start: 0, end: 0.1, vowel: "pau" },
  { start: 0.1, end: 0.3, vowel: "a" },
  { start: 0.3, end: 0.35, vowel: "cl" },
  { start: 0.35, end: 0.55, vowel: "i" },
  { start: 0.55, end: 0.6, vowel: "N" },
  { start: 0.7, end: 0.9, vowel: "u" },
];

const entriesB: readonly LipsyncEntry[] = [{ start: 0, end: 0.2, vowel: "e" }];

const mouth = {
  mouth: {
    a: "mouth-a.png",
    i: "mouth-i.png",
    u: "mouth-u.png",
    e: "mouth-e.png",
    o: "mouth-o.png",
    n: "mouth-n.png",
  },
};

const ryusei: Character = character({
  voice: { speaker: 13 },
  expressions: {
    normal: ["body.png", mouth],
    sweat: ["body.png", "fx-sweat.png"],
  },
});

const other: Character = character({
  expressions: { normal: ["other-body.png"] },
});

// 発話 1 は at: 0 にして absolute をそのまま local として使えるようにし、
// 減算による浮動小数の誤差 (例: 10 + 0.1 - 10 !== 0.1) が境界の判定
// (start<=local など) を誤らせないようにする。
const speech: readonly Speech[] = [
  { at: 0, duration: 1.0, lipsync: entriesA, by: ryusei },
  { at: 20, duration: 0.5, lipsync: entriesB, by: ryusei },
];

describe("mouthAt", () => {
  const cases: readonly [string, number, MouthKey][] = [
    ["どの発話区間にも入らない (前)", -5, "n"],
    ["どの発話区間にも入らない (後)", 100, "n"],
    ["発話 1: 冒頭の無音 (pau)", 0.05, "n"],
    ["発話 1: a の区間", 0.15, "a"],
    ["発話 1: a の開始境界 (start は含む)", 0.1, "a"],
    ["発話 1: cl (促音の無音、直前の a を維持)", 0.32, "a"],
    ["発話 1: cl と i の境界 (end は含まない)", 0.3, "a"],
    ["発話 1: i の区間", 0.45, "i"],
    ["発話 1: N (撥音 → n)", 0.58, "n"],
    ["発話 1: 子音の隙間 (直前の N → n を維持)", 0.65, "n"],
    ["発話 1: u の区間", 0.75, "u"],
    ["発話 1: 最後の entry より後 (直前の u を維持)", 0.95, "u"],
    ["発話 2 (2 本目): e の区間", 20.1, "e"],
  ];

  for (const [label, absolute, expected] of cases) {
    it(`${label} → "${expected}"`, () => {
      expect(mouthAt(absolute, speech)).toBe(expected);
    });
  }

  it("最初の entry より前 (entry が無い) は n", () => {
    const withGapAtStart: readonly Speech[] = [
      {
        at: 0,
        duration: 1,
        lipsync: [{ start: 0.5, end: 0.7, vowel: "a" }],
        by: ryusei,
      },
    ];

    expect(mouthAt(0.1, withGapAtStart)).toBe("n");
  });

  it("発話が重なる場合は at が大きい方 (後から始まった方) を使う (#3)", () => {
    const overlap: readonly Speech[] = [
      { at: 0, duration: 2, lipsync: entriesA, by: ryusei },
      { at: 0.5, duration: 2, lipsync: entriesB, by: ryusei },
    ];

    // absolute=0.6 はどちらの区間にも入る (0<=0.6<2 と 0.5<=0.6<2.5)。
    // at が大きい方 (0.5 開始、entriesB = e の区間) を使う。
    expect(mouthAt(0.6, overlap)).toBe("e");
  });

  it("at がフレーム境界のわずかに後にある発話でも、開始フレームで既に一致する (#21)", () => {
    // at: 10.04 (生の秒) は round(10.04 * fps) = 301 フレーム目に対応する。
    // Stage が渡す absolute は 301/fps (≈10.0333 秒、10.04 よりわずかに前)
    // になるため、秒のまま比較すると発話に一致せず口パクの開始が音声より
    // 1 フレーム遅れていた (#21 の症状)。フレームグリッドで比較すれば
    // frame 301 の時点で既にこの発話に一致する。local (= absolute - at)
    // はここではわずかに負になり、entries[0] (start: 0) の "pau" ではなく
    // 「最初の entry より前」の経路で "n" を返すが、この entry 自体
    // "pau" → "n" なのでどちらの経路でも結果は同じ "n" になる。
    const from = Math.round(10.04 * fps);
    const boundary: readonly Speech[] = [
      {
        at: 10.04,
        duration: 0.5,
        lipsync: [{ start: 0, end: 0.5, vowel: "pau" }],
        by: ryusei,
      },
    ];

    expect(mouthAt(from / fps, boundary)).toBe("n");
  });
});

describe("expressionAt", () => {
  it("どの発話より前は initial", () => {
    expect(expressionAt(-1, -1, "normal", [])).toBe("normal");
  });

  it("expression を持つ発話が始まった後はその表情", () => {
    const s: readonly Speech[] = [
      { at: 1, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
    ];

    expect(expressionAt(0.5, 0, "normal", s)).toBe("normal");
    expect(expressionAt(1, 0, "normal", s)).toBe("sweat");
    expect(expressionAt(100, 0, "normal", s)).toBe("sweat");
  });

  it("expression を持たない発話は表情を変えない", () => {
    const s: readonly Speech[] = [
      { at: 1, duration: 1, lipsync: [], by: ryusei },
    ];

    expect(expressionAt(2, 0, "normal", s)).toBe("normal");
  });

  it("複数の expression 指定は最後 (at が一番遅い) が勝つ", () => {
    const s: readonly Speech[] = [
      { at: 1, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
      { at: 3, duration: 1, lipsync: [], by: ryusei, expression: "normal" },
    ];

    expect(expressionAt(2, 0, "normal", s)).toBe("sweat");
    expect(expressionAt(3, 0, "normal", s)).toBe("normal");
  });

  it("item の開始 (itemStart) より前に始まった発話の expression は無視される (#2)", () => {
    const s: readonly Speech[] = [
      { at: 0, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
    ];

    // itemStart=2: at=0 の発話は item の開始より前なので無視され initial のまま。
    expect(expressionAt(3, 2, "normal", s)).toBe("normal");
  });

  it("item の開始 (itemStart) 以降に始まった発話の expression は適用される (#2)", () => {
    const s: readonly Speech[] = [
      { at: 2, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
    ];

    expect(expressionAt(3, 2, "normal", s)).toBe("sweat");
  });
});

describe("isBlinking", () => {
  const cases: readonly [string, number, boolean][] = [
    ["周期の頭 (0 秒) は開眼", 0, false],
    ["blinkClosed の直前 (3.89 秒) は開眼", 3.89, false],
    ["blinkInterval - blinkClosed (3.9 秒、境界) は閉眼", 3.9, true],
    ["末尾 (3.99 秒) は閉眼", 3.99, true],
    ["次の周期の頭 (4.0 秒) は開眼", 4.0, false],
    ["2 周期目の閉眼区間 (7.9 秒) は閉眼", 7.9, true],
  ];

  for (const [label, absolute, expected] of cases) {
    it(`${label} → ${expected}`, () => {
      expect(isBlinking(absolute)).toBe(expected);
    });
  }

  it("timing を差し替えられる", () => {
    const timing = { blinkInterval: 2, blinkClosed: 0.5 } as const;

    expect(isBlinking(1.4, timing)).toBe(false);
    expect(isBlinking(1.5, timing)).toBe(true);
    expect(isBlinking(2.0, timing)).toBe(false);
  });

  it("item を分割しても絶対秒基準の位相は変わらない (3 周期目でも同じ境界)", () => {
    // item 内の秒 (Sequence 相対) ではなく絶対秒で判定するため、item の
    // 開始位置に関わらず、同じ絶対秒 (mod blinkInterval) なら同じ結果になる。
    // 11.89 = 2 * 4 + 3.89 (開眼)、11.9 = 2 * 4 + 3.9 (閉眼の境界)。
    expect(isBlinking(11.89)).toBe(false);
    expect(isBlinking(11.9)).toBe(true);
  });
});

describe("layerSources", () => {
  it("静止画 (文字列) はそのまま", () => {
    expect(
      layerSources(["a.png", "b.png"], { blinking: false, mouth: "n" }),
    ).toEqual(["a.png", "b.png"]);
  });

  it("目レイヤーは blinking で開閉を選ぶ", () => {
    const layers = [{ eyes: { open: "open.png", closed: "closed.png" } }];

    expect(layerSources(layers, { blinking: false, mouth: "n" })).toEqual([
      "open.png",
    ]);
    expect(layerSources(layers, { blinking: true, mouth: "n" })).toEqual([
      "closed.png",
    ]);
  });

  it("口レイヤーは mouth で母音を選ぶ", () => {
    const layers = [
      {
        mouth: {
          a: "a.png",
          i: "i.png",
          u: "u.png",
          e: "e.png",
          o: "o.png",
          n: "n.png",
        },
      },
    ];

    expect(layerSources(layers, { blinking: false, mouth: "a" })).toEqual([
      "a.png",
    ]);
    expect(layerSources(layers, { blinking: false, mouth: "n" })).toEqual([
      "n.png",
    ]);
  });

  it("下から上の順を保つ", () => {
    const layers = [
      "body.png",
      { eyes: { open: "open.png", closed: "closed.png" } },
      "brows.png",
    ];

    expect(layerSources(layers, { blinking: true, mouth: "n" })).toEqual([
      "body.png",
      "closed.png",
      "brows.png",
    ]);
  });
});

describe("figure", () => {
  it("SampleNode (kind: sample) を返す", () => {
    const node = figure(ryusei, { speech });

    expect(isSample(node)).toBe(true);
  });

  it("expressions に無い expression を指定すると throw する", () => {
    expect(() => figure(ryusei, { expression: "unknown", speech })).toThrow(
      /unknown/,
    );
  });

  it("render() は Figure 要素を返し、layers が目パチ・口パク・表情から決まる", () => {
    const node = figure(ryusei, { speech });

    // absolute=0.15 (発話 1 の a) → normal 表情、口は "a"。
    const rendered = node.render({ frame: 0, seconds: 0, absolute: 0.15 });

    expect(isValidElement(rendered)).toBe(true);

    if (!isValidElement(rendered)) {
      throw new Error("unreachable");
    }

    expect(rendered.type).toBe(Figure);
    expect(rendered.props).toEqual({
      layers: [staticFile("body.png"), staticFile("mouth-a.png")],
    });
  });

  it("expression 指定の発話が始まると layers が切り替わる", () => {
    const withExpression: readonly Speech[] = [
      { at: 1, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
    ];
    const node = figure(ryusei, { speech: withExpression });

    const before = node.render({ frame: 0, seconds: 0, absolute: 0.5 });
    const after = node.render({ frame: 0, seconds: 0, absolute: 1 });

    if (!isValidElement(before) || !isValidElement(after)) {
      throw new Error("unreachable");
    }

    expect(before.props).toEqual({
      layers: [staticFile("body.png"), staticFile("mouth-n.png")],
    });
    expect(after.props).toEqual({
      layers: [staticFile("body.png"), staticFile("fx-sweat.png")],
    });
  });

  it("他の character 宛の発話は無視する (自分宛だけを使う)", () => {
    const mixed: readonly Speech[] = [
      { at: 0, duration: 10, lipsync: entriesA, by: other },
    ];
    const node = figure(ryusei, { speech: mixed });

    const rendered = node.render({ frame: 0, seconds: 0, absolute: 0.15 });

    if (!isValidElement(rendered)) {
      throw new Error("unreachable");
    }

    // other 宛の発話 (a の区間) は無視され、自分宛の発話が無いので口は n
    // (無音) のまま。フィルタしていなければここは mouth-a になる。
    expect(rendered.props).toEqual({
      layers: [staticFile("body.png"), staticFile("mouth-n.png")],
    });
  });

  it("item を分けると、その item の開始より前の expression 指定は無視され初期値に戻る (#2)", () => {
    const withExpression: readonly Speech[] = [
      { at: 0, duration: 5, lipsync: [], by: ryusei, expression: "sweat" },
    ];
    const node = figure(ryusei, { speech: withExpression });

    // item 1: 絶対 0 秒に始まり、絶対 2 秒 (item 内 2 秒) まで描く。
    // itemStart = absolute - seconds = 0 なので at=0 の expression が効く。
    const item1 = node.render({ frame: 60, seconds: 2, absolute: 2 });
    // item 2: 絶対 3 秒から新しい item (item を分割)。itemStart = 3 なので
    // at=0 の発話は item の開始より前で無視され、initial (normal) に戻る。
    const item2 = node.render({ frame: 0, seconds: 0, absolute: 3 });

    if (!isValidElement(item1) || !isValidElement(item2)) {
      throw new Error("unreachable");
    }

    expect(item1.props).toEqual({
      layers: [staticFile("body.png"), staticFile("fx-sweat.png")],
    });
    expect(item2.props).toEqual({
      layers: [staticFile("body.png"), staticFile("mouth-n.png")],
    });
  });

  it("expressions の prototype のキー (toString 等) を指定すると throw する (#11)", () => {
    expect(() => figure(ryusei, { expression: "toString", speech })).toThrow(
      /toString/,
    );
  });

  it("itemStart の浮動小数の丸め誤差でちらつかない (#14)", () => {
    // Stage が実際に render() へ渡す seconds・absolute の作り方を再現する。
    // item の開始 (from) は round(3 * fps) フレーム目、この item は
    // 10 * fps フレーム (= 10 秒) 続く。itemStart (= absolute - seconds) は
    // 数学的には from/fps = 3 と一致するはずだが、frame/fps 同士の引き算に
    // なるため、フレームによっては丸め誤差で 3 よりわずかに大きくなる。
    // at: 3 の発話 (expression: "sweat") が、そのフレームだけ initial
    // (normal) に戻ってちらつかないことを確認する。
    const from = Math.round(3 * fps);
    const withExpression: readonly Speech[] = [
      { at: 3, duration: 10, lipsync: [], by: ryusei, expression: "sweat" },
    ];
    const node = figure(ryusei, { speech: withExpression });

    for (let frame = 0; frame < 10 * fps; frame++) {
      const seconds = frame / fps;
      const absolute = (from + frame) / fps;
      const rendered = node.render({ frame, seconds, absolute });

      if (!isValidElement(rendered)) {
        throw new Error("unreachable");
      }

      expect(rendered.props).toEqual({
        layers: [staticFile("body.png"), staticFile("fx-sweat.png")],
      });
    }
  });

  it("item を speech の開始秒で分割しても丸め誤差で初回が抜けない (#14)", () => {
    // s.at (10.02) がフレーム境界に乗らない場合の再現。item.at = s.at = 10.02
    // で分割すると、Stage は from = round(10.02 * fps) = 301 で item を作る
    // (itemStart は数学的には 301/fps ≈ 10.0333 秒)。s.at (10.02、生の秒) を
    // 秒のまま itemStart と比べると足りず expression が一切効かなくなるため、
    // フレーム単位に丸めて比較する必要がある (#14 の症状そのもの)。ここでは
    // item の全フレームで expression が適用されることを確認する。
    const from = Math.round(10.02 * fps);
    const withExpression: readonly Speech[] = [
      { at: 10.02, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
    ];
    const node = figure(ryusei, { speech: withExpression });

    for (let frame = 0; frame < 5; frame++) {
      const seconds = frame / fps;
      const absolute = (from + frame) / fps;
      const rendered = node.render({ frame, seconds, absolute });

      if (!isValidElement(rendered)) {
        throw new Error("unreachable");
      }

      expect(rendered.props).toEqual({
        layers: [staticFile("body.png"), staticFile("fx-sweat.png")],
      });
    }
  });

  it("item の開始より前のフレームで始まった発話の expression は適用されない (#14)", () => {
    // 前のテストと同じ item (from = 301) だが、発話は 1 フレーム前
    // (at: 10.00 → frame 300) に始まっている。item の開始 (frame 301) より
    // 前に始まった発話なので、丸めても itemStart より前のまま initial に戻る。
    const from = Math.round(10.02 * fps);
    const withExpression: readonly Speech[] = [
      { at: 10.0, duration: 1, lipsync: [], by: ryusei, expression: "sweat" },
    ];
    const node = figure(ryusei, { speech: withExpression });

    const rendered = node.render({
      frame: 0,
      seconds: 0,
      absolute: from / fps,
    });

    if (!isValidElement(rendered)) {
      throw new Error("unreachable");
    }

    expect(rendered.props).toEqual({
      layers: [staticFile("body.png"), staticFile("mouth-n.png")],
    });
  });
});
