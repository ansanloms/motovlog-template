import React from "react";
import { Video } from "../../src/components/Video.tsx";
import { assertVolume } from "../core/index.ts";

/** Video の要素ファクトリ。不正な volume はここで throw する。 */
export const video = (props: React.ComponentProps<typeof Video>) => {
  assertVolume(props.volume ?? 1);

  return <Video {...props} />;
};
