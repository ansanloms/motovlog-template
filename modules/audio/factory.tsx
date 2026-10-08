import React from "react";
import { Audio } from "./Audio.tsx";
import { assertVolume } from "@motovlog/core";

/** Audio の要素ファクトリ。不正な volume はここで throw する。 */
export const audio = (props: React.ComponentProps<typeof Audio>) => {
  assertVolume(props.volume ?? 1);

  return <Audio {...props} />;
};
