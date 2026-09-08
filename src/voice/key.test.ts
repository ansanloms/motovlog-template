import { describe, expect, it } from "vitest";
import { linePath, resolveVoice, voiceKey } from "./key.ts";

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
});

describe("linePath", () => {
  it("slug と key から相対パスを組む", () => {
    expect(linePath("00000000-sample", "abc123")).toBe(
      "projects/00000000-sample/lines/abc123",
    );
  });
});
