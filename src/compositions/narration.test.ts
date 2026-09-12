import React from "react";
import { staticFile } from "remotion";
import { describe, expect, it, vi } from "vitest";
import { annotation } from "../components/index.tsx";
import { Line } from "../components/Line.tsx";
import { cut, fade, frame, start } from "../effects/index.ts";
import type { CutItem, FadeItem } from "../effects/index.ts";
import { bandTiming, subtitleTiming } from "../theme/index.ts";
import type { LipsyncEntry, VoiceCache, VoiceOptions } from "../voice/cache.ts";
import { linePath, resolveVoice, voiceKey } from "../voice/key.ts";
import { character } from "./character.ts";
import { line, narration } from "./narration.ts";

/** isVoiceCache を通る偽のキャッシュ本体を組む。duration 以外は固定値 (voice・lipsync は overrides で差し替え可)。 */
const fakeCache = (
  duration: number,
  overrides: { voice?: VoiceOptions; lipsync?: LipsyncEntry[] } = {},
): VoiceCache => ({
  text: "dummy",
  voice: resolveVoice(overrides.voice),
  reading: "dummy",
  duration,
  lipsync: overrides.lipsync ?? [],
  generatedAt: "2026-09-08T00:00:00Z",
});

/** fetchCacheFor に渡す 1 エントリ分の指定。数値だけなら duration (voice は既定)。 */
type CacheSpec =
  number | { duration: number; voice?: VoiceOptions; lipsync?: LipsyncEntry[] };

/**
 * text ごとの実尺 (voice・lipsync も指定可) から、URL に voiceKey({ text, voice })
 * の key を含むリクエストにだけ 200 で応答する fetchCache を組む。
 */
const fetchCacheFor = async (
  durationsByText: Record<string, CacheSpec>,
): Promise<typeof fetch> => {
  const entries = await Promise.all(
    Object.entries(durationsByText).map(async ([text, spec]) => {
      const { duration, voice, lipsync } =
        typeof spec === "number" ? { duration: spec } : spec;
      const key = await voiceKey({ text, voice });

      return [key, fakeCache(duration, { voice, lipsync })] as const;
    }),
  );

  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const found = entries.find(([key]) => url.includes(key));

    if (!found) {
      return new Response("not found", { status: 404 });
    }

    return new Response(JSON.stringify(found[1]), { status: 200 });
  }) as typeof fetch;
};

describe("narration", () => {
  it("after は音声の実尺の終わりを基準に解決し、字幕の尺は次の item の開始までにクランプされる", async () => {
    const fetchCache = await fetchCacheFor({ A: 2.0, B: 1.0 });

    const {
      layers: [, speechLayer],
    } = await narration(
      [
        cut(line({ text: "A" }), { at: 10 }),
        cut(line({ text: "B" }), { after: 0.5 }),
      ],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    const a = speechLayer[0] as CutItem;
    const b = speechLayer[1] as CutItem;

    expect(a.at).toBe(10);
    expect(b.at).toBe(12.5);
    expect(a.duration).toBe(
      Math.min(2.0 + subtitleTiming.tail, (b.at as number) - (a.at as number)),
    );
    // 最後の item は実尺 + tail のまま。
    expect(b.duration).toBe(1.0 + subtitleTiming.tail);
  });

  it("duration を明示した line() item は位置決め・字幕の尺の両方に明示値をそのまま使う (実尺で上書きしない)", async () => {
    const fetchCache = await fetchCacheFor({ A: 2.0 });

    const explicit: CutItem = {
      kind: "cut",
      node: line({ text: "A" }),
      at: 10,
      duration: 999,
    };

    const {
      layers: [, speechLayer],
    } = await narration(
      [explicit],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    const a = speechLayer[0] as CutItem;

    expect(a.at).toBe(10);
    expect(a.duration).toBe(999);
  });

  it("duration を明示した line() item では、暗がりの区間も字幕の消灯 (duration 分) + fadeOut まで続く", async () => {
    const fetchCache = await fetchCacheFor({ A: 2.0 });

    const explicit: CutItem = {
      kind: "cut",
      node: line({ text: "A" }),
      at: 10,
      duration: 999,
    };

    const {
      layers: [bandLayer],
    } = await narration(
      [explicit],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    const span = bandLayer[0] as FadeItem;

    // 字幕の消灯は at + duration (999) = 1009。実尺 (2.0 秒) はもっと短いが、
    // 暗がりは字幕が消えるまで維持されるので、区間の終端は 1009 + fadeOut
    // になる (実尺基準の 12 + tail + fadeOut ではない)。
    const expectedStart = 10 - bandTiming.leadIn;
    const expectedEnd = 1009 + bandTiming.fadeOut;

    expect(span.at).toBeCloseTo(expectedStart, 6);
    expect(span.duration).toBeCloseTo(expectedEnd - expectedStart, 6);
  });

  it("items が空なら throw する", async () => {
    await expect(
      narration([], { slug: "sample" }, { isStudio: () => false }),
    ).rejects.toThrow(/narration: 発話が 1 つもありません/);
  });

  it("item の at にアンカーを渡すと throw する (narration() は下の layer を知らないため使えない)", async () => {
    const other = cut(annotation({ text: "x" }), { at: 0, duration: 1 });

    await expect(
      narration(
        [cut(line({ text: "A" }), { at: start(other) })],
        { slug: "sample" },
        { isStudio: () => false },
      ),
    ).rejects.toThrow(/narration の item の at は秒の数値だけ受け付けます/);
  });

  it("item の node に frame() を渡すと throw する", async () => {
    await expect(
      narration(
        [fade(frame(), { at: 0, duration: 1, in: 1 })],
        { slug: "sample" },
        { isStudio: () => false },
      ),
    ).rejects.toThrow(
      /narration: frame\(\) は narration\(\) の item に置けません/,
    );
  });

  it("item の位置解決に失敗すると narration: の位置付きエラーに包み直される", async () => {
    const fetchCache = await fetchCacheFor({ A: 1, B: 1 });

    await expect(
      narration(
        [
          cut(line({ text: "A" }), { at: 5 }),
          cut(line({ text: "B" }), { at: 0 }),
        ],
        { slug: "sample" },
        { fetchCache, isStudio: () => false },
      ),
    ).rejects.toThrow(/^narration: 発話の位置を解決できません/);
  });

  it("line() 以外の cut() item は解決済み at で発話 layer に残る", async () => {
    const fetchCache = await fetchCacheFor({});

    const {
      layers: [, speechLayer],
    } = await narration(
      [cut(annotation({ text: "x" }), { after: 1, duration: 3 })],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(speechLayer).toHaveLength(1);

    const item = speechLayer[0] as CutItem;

    expect(item.kind).toBe("cut");
    expect(item.at).toBe(1);
    expect(item.duration).toBe(3);
    expect("after" in item).toBe(false);
    expect(React.isValidElement(item.node)).toBe(true);
  });

  it("line() 以外の fade() item は in/out を保ったまま解決済み at で発話 layer に残る", async () => {
    const fetchCache = await fetchCacheFor({});

    const {
      layers: [, speechLayer],
    } = await narration(
      [
        fade(annotation({ text: "y" }), {
          at: 5,
          duration: 2,
          in: 0.5,
          out: 0.5,
        }),
      ],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(speechLayer).toHaveLength(1);

    const item = speechLayer[0] as FadeItem;

    expect(item.kind).toBe("fade");
    expect(item.at).toBe(5);
    expect(item.duration).toBe(2);
    expect(item.in).toBe(0.5);
    expect(item.out).toBe(0.5);
    expect("after" in item).toBe(false);
  });

  it("line() 以外で duration が無ければ throw し、メッセージに item の index を含む", async () => {
    const fetchCache = await fetchCacheFor({});

    await expect(
      narration(
        [cut(annotation({ text: "x" }), { at: 1 })],
        { slug: "sample" },
        { fetchCache, isStudio: () => false },
      ),
    ).rejects.toThrow(/item 0/);
  });

  it("暗がり layer: 隙間が silenceGap 以内の 2 発話は 1 つの fade に統合する", async () => {
    const fetchCache = await fetchCacheFor({ P: 1, Q: 1 });
    // P: [1, 2)、Q: [7, 8)。隙間 5 <= silenceGap 5 (境界)。

    const {
      layers: [bandLayer],
    } = await narration(
      [
        cut(line({ text: "P" }), { at: 1 }),
        cut(line({ text: "Q" }), { at: 7 }),
      ],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(bandLayer).toHaveLength(1);

    const span = bandLayer[0] as FadeItem;

    expect(span.kind).toBe("fade");
    expect(span.at).toBe(1 - bandTiming.leadIn);
    expect(span.in).toBe(bandTiming.leadIn);
    expect(span.out).toBe(bandTiming.fadeOut);
  });

  it("暗がり layer: 隙間が silenceGap を超える 2 発話は 2 つの fade になる", async () => {
    const fetchCache = await fetchCacheFor({ P: 1, Q: 1 });
    // P: [1, 2)、Q: [8, 9)。隙間 6 > silenceGap 5。

    const {
      layers: [bandLayer],
    } = await narration(
      [
        cut(line({ text: "P" }), { at: 1 }),
        cut(line({ text: "Q" }), { at: 8 }),
      ],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(bandLayer).toHaveLength(2);

    const first = bandLayer[0] as FadeItem;
    const second = bandLayer[1] as FadeItem;

    expect(first.at).toBe(1 - bandTiming.leadIn);
    expect(first.in).toBe(bandTiming.leadIn);
    expect(first.out).toBe(bandTiming.fadeOut);

    expect(second.at).toBe(8 - bandTiming.leadIn);
    expect(second.in).toBe(bandTiming.leadIn);
    expect(second.out).toBe(bandTiming.fadeOut);
  });

  it("Studio では 404 が続いても waitIntervalMs 間隔で待って取得でき、sleep が 2 回呼ばれる", async () => {
    let calls = 0;
    const fetchCache = (async () => {
      calls += 1;

      if (calls < 3) {
        return new Response("not found", { status: 404 });
      }

      return new Response(JSON.stringify(fakeCache(1.5)), { status: 200 });
    }) as typeof fetch;
    const sleep = vi.fn(async () => {});

    const {
      layers: [, speechLayer],
    } = await narration(
      [cut(line({ text: "R" }), { at: 0 })],
      { slug: "sample" },
      { fetchCache, isStudio: () => true, sleep },
    );

    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect((speechLayer[0] as CutItem).duration).toBe(
      1.5 + subtitleTiming.tail,
    );
  });

  it("Studio でなければ 1 回で throw し、メッセージに URL と npm run dev を含む", async () => {
    let calls = 0;
    const fetchCache = (async () => {
      calls += 1;

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const key = await voiceKey({ text: "S" });
    const expectedUrl = staticFile(`${linePath("sample", key)}.json`);

    let error: unknown;

    try {
      await narration(
        [cut(line({ text: "S" }), { at: 0 })],
        { slug: "sample" },
        { fetchCache, isStudio: () => false },
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(expectedUrl);
    expect((error as Error).message).toContain("npm run dev");
    expect(calls).toBe(1);
  });

  it("待ちの打ち切り: waitTimeoutMs/waitIntervalMs から求めた回数だけ試して throw する", async () => {
    let calls = 0;
    const fetchCache = (async () => {
      calls += 1;

      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    const sleep = vi.fn(async () => {});

    await expect(
      narration(
        [cut(line({ text: "U" }), { at: 0 })],
        { slug: "sample" },
        {
          fetchCache,
          isStudio: () => true,
          waitIntervalMs: 500,
          waitTimeoutMs: 1000,
          sleep,
        },
      ),
    ).rejects.toThrow();

    expect(calls).toBe(Math.floor(1000 / 500) + 1);
  });

  it("発話 layer の node は Line 要素で、props.src が .wav、props.text が渡した text", async () => {
    const fetchCache = await fetchCacheFor({ T: 1 });

    const {
      layers: [, speechLayer],
    } = await narration(
      [cut(line({ text: "T" }), { at: 0 })],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    const node = (speechLayer[0] as CutItem).node;

    expect(React.isValidElement(node)).toBe(true);

    if (!React.isValidElement(node)) {
      throw new Error("unreachable");
    }

    expect(node.type).toBe(Line);

    const props = node.props as { text: string; src: string };

    expect(props.text).toBe("T");
    expect(props.src.endsWith(".wav")).toBe(true);
  });

  it("line() の text を配列で書くと改行で結合した文字列と同じ key の音声キャッシュを読む", async () => {
    const fetchCache = await fetchCacheFor({ "a\nb": 1 });

    const {
      layers: [, speechLayer],
    } = await narration(
      [cut(line({ text: ["a", "b"] }), { at: 0 })],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    const node = (speechLayer[0] as CutItem).node;

    if (!React.isValidElement(node)) {
      throw new Error("unreachable");
    }

    const props = node.props as { text: string };

    expect(props.text).toBe("a\nb");
  });

  it("speech は line() item ごとに、渡した順で at・duration (字幕ではなく実尺)・lipsync を持つ", async () => {
    const fetchCache = await fetchCacheFor({
      A: { duration: 2, lipsync: [{ start: 0, end: 1, vowel: "a" }] },
      B: { duration: 1, lipsync: [{ start: 0, end: 0.5, vowel: "i" }] },
    });

    const explicitB: CutItem = {
      kind: "cut",
      node: line({ text: "B" }),
      at: 10,
      duration: 999,
    };

    const { speech } = await narration(
      [cut(line({ text: "A" }), { at: 0 }), explicitB],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(speech).toHaveLength(2);
    expect(speech[0]).toMatchObject({
      at: 0,
      duration: 2,
      lipsync: [{ start: 0, end: 1, vowel: "a" }],
    });
    // duration を明示した item でも speech.duration は実尺 (999 ではなく 1)。
    expect(speech[1]).toMatchObject({
      at: 10,
      duration: 1,
      lipsync: [{ start: 0, end: 0.5, vowel: "i" }],
    });
  });

  it("duration を明示した line() item が実尺より短ければ speech.duration はその値にクランプされる (#3)", async () => {
    const fetchCache = await fetchCacheFor({ A: 2.0 });

    const explicit: CutItem = {
      kind: "cut",
      node: line({ text: "A" }),
      at: 0,
      duration: 1.2,
    };

    const { speech } = await narration(
      [explicit],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    // 実尺 (2.0 秒) は明示した duration (1.2 秒、字幕の尺) より長いが、
    // 音声が実際に鳴るのは字幕が消えるまでの 1.2 秒だけなので
    // speech.duration はクランプされる (無音のまま口が動き続けるのを防ぐ)。
    expect(speech[0].duration).toBe(1.2);
  });

  it("speech[i].by・expression は line() で指定した値をそのまま持ち、未指定なら undefined", async () => {
    const c = character({
      voice: { speaker: 13 },
      expressions: { normal: ["a.png"], smile: ["b.png"] },
    });
    const fetchCache = await fetchCacheFor({
      A: { duration: 1, voice: c.voice },
      B: 1,
    });

    const { speech } = await narration(
      [
        cut(line({ text: "A", by: c, expression: "smile" }), { at: 0 }),
        cut(line({ text: "B" }), { after: 0 }),
      ],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(speech[0].by).toBe(c);
    expect(speech[0].expression).toBe("smile");
    expect(speech[1].by).toBeUndefined();
    expect(speech[1].expression).toBeUndefined();
  });

  it("line() の声質は theme の narrator ← by.voice ← line() の voice の順で上書きした値が音声キャッシュの key に使われる", async () => {
    const c = character({
      voice: { speaker: 13, speed: 0.8 },
      expressions: { normal: ["a.png"] },
    });

    // by.voice だけを使った実効値 { speaker: 13, speed: 0.8 } のキーにだけ応答する。
    const fetchCacheBaseOnly = await fetchCacheFor({
      A: { duration: 1, voice: { speaker: 13, speed: 0.8 } },
    });

    const { speech: baseSpeech } = await narration(
      [cut(line({ text: "A", by: c }), { at: 0 })],
      { slug: "sample" },
      { fetchCache: fetchCacheBaseOnly, isStudio: () => false },
    );

    expect(baseSpeech[0].duration).toBe(1);

    // line() の voice で speed を上書きすると、by.voice だけの実効値のキーでは
    // ヒットしなくなる (by.voice や既定値だけで key を作っていないことの確認)。
    await expect(
      narration(
        [cut(line({ text: "A", by: c, voice: { speed: 1.2 } }), { at: 0 })],
        { slug: "sample" },
        { fetchCache: fetchCacheBaseOnly, isStudio: () => false },
      ),
    ).rejects.toThrow(/発話の音声キャッシュが見つかりません/);

    // 上書き後の実効値 { speaker: 13, speed: 1.2 } のキーにだけ応答する。
    const fetchCacheOverride = await fetchCacheFor({
      A: { duration: 2, voice: { speaker: 13, speed: 1.2 } },
    });

    const { speech: overrideSpeech } = await narration(
      [cut(line({ text: "A", by: c, voice: { speed: 1.2 } }), { at: 0 })],
      { slug: "sample" },
      { fetchCache: fetchCacheOverride, isStudio: () => false },
    );

    expect(overrideSpeech[0].duration).toBe(2);

    // by.voice だけの実効値 (speed: 0.8) のキーでは、上書き後の line() にはヒットしない。
    await expect(
      narration(
        [cut(line({ text: "A", by: c }), { at: 0 })],
        { slug: "sample" },
        { fetchCache: fetchCacheOverride, isStudio: () => false },
      ),
    ).rejects.toThrow(/発話の音声キャッシュが見つかりません/);
  });

  it("line() は voice: null と reading を同時に指定すると即 throw する", () => {
    expect(() => line({ text: "A", voice: null, reading: "エー" })).toThrow(
      /声無しの行 \(voice: null\) に reading は書けません/,
    );
  });

  it("line() は by 無しで expression を指定すると即 throw する", () => {
    expect(() => line({ text: "A", expression: "x" })).toThrow(
      /expression \("x"\) を指定するには by \(character の参照\) が必要です/,
    );
  });

  it("line() は by.expressions に無い expression を指定すると即 throw する", () => {
    const c = character({ expressions: { normal: ["a.png"] } });

    expect(() => line({ text: "A", by: c, expression: "nope" })).toThrow(
      /by に無い表情 "nope" が指定されました/,
    );
  });

  it("line() は by.expressions の prototype のキー (toString 等) を指定すると即 throw する (#11)", () => {
    const c = character({ expressions: { normal: ["a.png"] } });

    expect(() => line({ text: "A", by: c, expression: "toString" })).toThrow(
      /by に無い表情 "toString" が指定されました/,
    );
  });

  it("line() 以外の item (annotation だけの cut()) は speech に含まれない", async () => {
    const fetchCache = await fetchCacheFor({ A: 1 });

    const { speech } = await narration(
      [
        cut(line({ text: "A" }), { at: 0 }),
        cut(annotation({ text: "x" }), { after: 0, duration: 1 }),
      ],
      { slug: "sample" },
      { fetchCache, isStudio: () => false },
    );

    expect(speech).toHaveLength(1);
    expect(speech[0].at).toBe(0);
  });
});
