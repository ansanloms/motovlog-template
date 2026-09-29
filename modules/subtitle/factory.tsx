import React from "react";
import { SubtitleBand } from "../../src/components/SubtitleBand.tsx";

/** SubtitleBand の要素ファクトリ。 */
export const subtitleBand = (
  props: React.ComponentProps<typeof SubtitleBand>,
) => <SubtitleBand {...props} />;
