import { describe, expect, it } from "vitest";
import { linePath, mergeVoice, resolveVoice, voiceKey } from "./key.ts";

describe("voiceKey", () => {
  it("同じ入力なら同じ key になる", async () => {
    const a = await voiceKey({ text: "こんにちは" });
    const b = await voiceKey({ text: "こんにちは" });

    expect(a).toBe(b);
  });

  it("voice 省略と既定値を明示した場合は同じ key になる", async () => {
    const omitted = await voiceKey({ text: "こんにちは" });
    const explicit = await voiceKey({
      text: "こんにちは",
      voice: resolveVoice(undefined),
    });

    expect(omitted).toBe(explicit);
  });

  it("text が 1 文字違うと別の key になる", async () => {
    const a = await voiceKey({ text: "こんにちは" });
    const b = await voiceKey({ text: "こんにちわ" });

    expect(a).not.toBe(b);
  });

  it("voice の speaker が違うと別の key になる", async () => {
    const a = await voiceKey({ text: "こんにちは", voice: { speaker: 1 } });
    const b = await voiceKey({ text: "こんにちは", voice: { speaker: 2 } });

    expect(a).not.toBe(b);
  });

  it("hex 64 文字 (SHA-256) を返す", async () => {
    const key = await voiceKey({ text: "こんにちは" });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reading 無しは従来と同じ JSON を hash する (既存キャッシュの key を変えない)", async () => {
    const withoutReading = await voiceKey({ text: "こんにちは" });
    const legacy = await (async () => {
      const json = JSON.stringify({
        text: "こんにちは",
        voice: resolveVoice(undefined),
      });
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(json),
      );

      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    })();

    expect(withoutReading).toBe(legacy);
  });

  it("reading の有無で key が変わる", async () => {
    const withoutReading = await voiceKey({ text: "こんにちは" });
    const withReading = await voiceKey({
      text: "こんにちは",
      reading: "こんにちわ",
    });

    expect(withoutReading).not.toBe(withReading);
  });
});

describe("mergeVoice", () => {
  it("base・voice が両方 undefined なら undefined", () => {
    expect(mergeVoice(undefined, undefined)).toBeUndefined();
  });

  it("voice が undefined なら base をそのまま返す", () => {
    expect(mergeVoice({ speaker: 13 }, undefined)).toEqual({ speaker: 13 });
  });

  it("base が undefined なら voice をそのまま返す", () => {
    expect(mergeVoice(undefined, { speaker: 13 })).toEqual({ speaker: 13 });
  });

  it("voice が base の同じキーを上書きする", () => {
    expect(mergeVoice({ speaker: 13, speed: 1 }, { speed: 0.9 })).toEqual({
      speaker: 13,
      speed: 0.9,
    });
  });

  it("mergeVoice の結果を渡した voiceKey() は、その値を明示した voiceKey() と同じ key になる", async () => {
    const merged = mergeVoice({ speaker: 13, speed: 1 }, { speed: 0.9 });
    const a = await voiceKey({ text: "x", voice: merged });
    const b = await voiceKey({ text: "x", voice: { speaker: 13, speed: 0.9 } });

    expect(a).toBe(b);
  });
});

describe("linePath", () => {
  it("slug と key から相対パスを組む", () => {
    expect(linePath("00000000-sample", "abc123")).toBe(
      "projects/00000000-sample/lines/abc123",
    );
  });
});
