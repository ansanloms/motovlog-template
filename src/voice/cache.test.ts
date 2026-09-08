import { describe, expect, it } from "vitest";
import { VOICE_KEYS, isVoiceCache } from "./cache.ts";
import type { Voice } from "./cache.ts";

const VOICE = {
  speaker: 13,
  speed: 1,
  pitch: 0,
  intonation: 1,
  volume: 1,
  pause: 1,
  silenceBefore: 0.1,
  silenceAfter: 0.1,
};

describe("isVoiceCache", () => {
  it("正常形は true", () => {
    expect(
      isVoiceCache({
        text: "今日は{浄土平|じょうどだいら}まで走った。",
        voice: VOICE,
        reading: "今日はじょうどだいらまで走った。",
        duration: 1.234,
        lipsync: [{ start: 0, end: 0.1, vowel: "a" }],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("null は false", () => {
    expect(isVoiceCache(null)).toBe(false);
  });

  it("text が無ければ false", () => {
    expect(
      isVoiceCache({
        voice: VOICE,
        reading: "",
        duration: 1,
        lipsync: [],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("voice の項目が 1 つでも数値でなければ false", () => {
    expect(
      isVoiceCache({
        text: "a",
        voice: { ...VOICE, pitch: "0" },
        reading: "a",
        duration: 1,
        lipsync: [],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("voice の項目が欠けていれば false", () => {
    expect(
      isVoiceCache({
        text: "a",
        voice: { speaker: 13 },
        reading: "a",
        duration: 1,
        lipsync: [],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("duration が NaN なら false", () => {
    expect(
      isVoiceCache({
        text: "a",
        voice: VOICE,
        reading: "a",
        duration: Number.NaN,
        lipsync: [],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("lipsync が配列でなければ false", () => {
    expect(
      isVoiceCache({
        text: "a",
        voice: VOICE,
        reading: "a",
        duration: 1,
        lipsync: "not-an-array",
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("lipsync entry が vowel を欠けば false", () => {
    expect(
      isVoiceCache({
        text: "a",
        voice: VOICE,
        reading: "a",
        duration: 1,
        lipsync: [{ start: 0, end: 0.1 }],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("lipsync が空配列でも true", () => {
    expect(
      isVoiceCache({
        text: "a",
        voice: VOICE,
        reading: "a",
        duration: 1,
        lipsync: [],
        generatedAt: "2026-09-08T00:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("VOICE_KEYS", () => {
  it("Voice の全項目と過不足なく一致する (型を変えたらこの sample も直す)", () => {
    const sample: Voice = {
      speaker: 0,
      speed: 0,
      pitch: 0,
      intonation: 0,
      volume: 0,
      pause: 0,
      silenceBefore: 0,
      silenceAfter: 0,
    };

    expect([...VOICE_KEYS].sort()).toEqual(Object.keys(sample).sort());
  });
});
