import React from "react";
import { Composition } from "remotion";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog.tsx";
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./effects/index.ts";
import { DEFAULT_PROJECT } from "./project/load.ts";
import { fps } from "./theme/index.ts";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Motovlog"
        component={Motovlog}
        defaultProps={{
          slug: process.env.REMOTION_PROJECT || DEFAULT_PROJECT,
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
