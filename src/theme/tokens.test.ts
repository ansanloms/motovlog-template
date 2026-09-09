import { describe, expect, it } from "vitest";
import { figureLayout, figureMotion } from "./tokens.ts";

describe("figureLayout.breathHeadroom", () => {
  it("呼吸で上へ動く最大量 (breathLift + boxHeight × breathScale) 以上である", () => {
    const maxLift =
      figureMotion.breathLift +
      figureLayout.boxHeight * figureMotion.breathScale;

    expect(figureLayout.breathHeadroom).toBeGreaterThanOrEqual(maxLift);
  });
});
