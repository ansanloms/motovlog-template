import { describe, expect, it } from "vitest";
import { clip } from "./clip.ts";
import { fade } from "./fade.ts";
import { video } from "./video.ts";

describe("video", () => {
  it("durationSec は全アイテムの (at + duration) の最大値", () => {
    const result = video({ fps: 30 }, [
      clip({ src: "a.mp4", duration: 5 }),
      fade(null, { at: 3, duration: 4 }),
    ]);

    expect(result.durationSec).toBe(7);
  });

  it("clip の at を省略すると直前の clip の終端に連結する", () => {
    const result = video({ fps: 30 }, [
      clip({ src: "a.mp4", duration: 5 }),
      clip({ src: "b.mp4", duration: 3 }),
    ]);

    expect(result.items[0].at).toBe(0);
    expect(result.items[1].at).toBe(5);
  });

  it("items が空なら throw する", () => {
    expect(() => video({ fps: 30 }, [])).toThrow();
  });

  it("fade の in + out が duration を超えるなら throw する", () => {
    expect(() =>
      video({ fps: 30 }, [
        fade(null, { at: 0, duration: 1, in: 0.6, out: 0.6 }),
      ]),
    ).toThrow();
  });
});
