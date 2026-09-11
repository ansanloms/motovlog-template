import React from "react";
import { Composition } from "remotion";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog.tsx";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./effects/index.ts";
import { resolveProjectSlug } from "./project/load.ts";
import { fps } from "./theme/index.ts";

/** Remotion の入口。Motovlog composition を 1 本だけ登録する。 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Motovlog"
        component={Motovlog}
        defaultProps={{
          slug: resolveProjectSlug(process.env.REMOTION_PROJECT),
        }}
        calculateMetadata={calculateMetadata}
        fps={fps}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        durationInFrames={1}
      />
    </>
  );
};
