import { describe, expect, it } from "vitest";
import * as timing from "./timing.ts";

// timing.ts の export を全部走査するので、export を足すと自動で検査対象になる。

// 浮動小数の誤差 (例: 0.2 * 30 = 6.000000000000001) を丸めてから整数判定する。
const isFrameAligned = (sec: number): boolean =>
  Number.isInteger(Math.round(sec * timing.fps * 1e6) / 1e6);

describe("timing の秒数は fps でフレーム割りできる", () => {
  let checkedCount = 0;

  for (const [name, value] of Object.entries(timing)) {
    if (name === "fps") {
      continue;
    }

    if (typeof value === "number") {
      checkedCount += 1;
      it(`${name} (${value}秒) がフレーム割りできる`, () => {
        expect(isFrameAligned(value)).toBe(true);
      });
      continue;
    }

    if (typeof value === "object" && value !== null) {
      for (const [key, sec] of Object.entries(value)) {
        if (typeof sec !== "number") {
          continue;
        }

        checkedCount += 1;
        it(`${name}.${key} (${sec}秒) がフレーム割りできる`, () => {
          expect(isFrameAligned(sec)).toBe(true);
        });
      }
    }
  }

  it("検査対象が 1 件以上ある", () => {
    expect(checkedCount).toBeGreaterThanOrEqual(1);
  });
});

describe("fps", () => {
  it("正の整数である", () => {
    // ADR-0003: GOP 長 = fps (1 秒ごとにキーフレーム) を整数で保つため
    expect(Number.isInteger(timing.fps)).toBe(true);
    expect(timing.fps).toBeGreaterThan(0);
  });
});
