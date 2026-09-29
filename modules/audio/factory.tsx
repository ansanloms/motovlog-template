import React from "react";
import { Audio } from "../../src/components/Audio.tsx";
import { assertVolume } from "../core/index.ts";

/** Audio の要素ファクトリ。不正な volume はここで throw する。 */
export const audio = (props: React.ComponentProps<typeof Audio>) => {
  assertVolume(props.volume ?? 1);

  return <Audio {...props} />;
};
