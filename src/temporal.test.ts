import { describe, expect, it } from "vitest";

// vitest の setupFiles (test/setup.ts) で temporal-polyfill/global を
// 読み込んでいるため、import なしで Temporal がグローバルに使えることを
// 確認する (ADR-0007)。
describe("Temporal", () => {
  it("polyfill がグローバルに読み込まれている", () => {
    expect(
      Temporal.Duration.from({ minutes: 5 }).total({ unit: "minutes" }),
    ).toBe(5);
  });
});
