import "../test/setup.ts";
import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";

// test/setup.ts が temporal-polyfill/global を読み込んでいるため、Temporal を
// import せずグローバルに使えることを確認する (ADR-0007)。
describe("Temporal", () => {
  it("polyfill がグローバルに読み込まれている", () => {
    expect(
      Temporal.Duration.from({ minutes: 5 }).total({ unit: "minutes" }),
    ).toBe(5);
  });
});
