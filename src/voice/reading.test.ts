import { describe, expect, it } from "vitest";
import { displayText, readingText } from "./reading.ts";

describe("displayText", () => {
  it("{漢字|よみ} を漢字側に展開する", () => {
    expect(displayText("今日は{浄土平|じょうどだいら}まで走った。")).toBe(
      "今日は浄土平まで走った。",
    );
  });

  it("複数出現をすべて展開する", () => {
    expect(displayText("{東京|とうきょう}から{大阪|おおさか}まで")).toBe(
      "東京から大阪まで",
    );
  });

  it("記法が無ければそのまま返す", () => {
    expect(displayText("バイクはGB350Cだ。")).toBe("バイクはGB350Cだ。");
  });
});

describe("readingText", () => {
  it("{漢字|よみ} をよみ側に展開する", () => {
    expect(readingText("今日は{浄土平|じょうどだいら}まで走った。")).toBe(
      "今日はじょうどだいらまで走った。",
    );
  });

  it("複数出現をすべて展開する", () => {
    expect(readingText("{東京|とうきょう}から{大阪|おおさか}まで")).toBe(
      "とうきょうからおおさかまで",
    );
  });

  it("記法が無ければそのまま返す", () => {
    expect(readingText("バイクはGB350Cだ。")).toBe("バイクはGB350Cだ。");
  });

  it("ネストは非対応で、内側の {…|…} だけが展開され外側は壊れたまま残る", () => {
    // [^{}|] は { を許さないため、最内周の {b|c} だけがマッチし展開される。
    // 外側の { と最後の |d} は記法として解釈されずそのまま残る。
    expect(readingText("{a{b|c}|d}")).toBe("{ac|d}");
  });

  it("改行 (\\n・\\r) を取り除く", () => {
    expect(readingText("今日は{浄土平|じょうどだいら}まで\n走ってきた。")).toBe(
      "今日はじょうどだいらまで走ってきた。",
    );
    expect(readingText("あ\r\nい")).toBe("あい");
  });
});
