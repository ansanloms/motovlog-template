import React from "react";
import { Composition } from "remotion";
import { z } from "zod";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog.tsx";
import { voicedTimelineSchema } from "./timeline/schema.ts";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Motovlog"
        component={Motovlog}
        schema={z.object({ timeline: voicedTimelineSchema.nullable() })}
        defaultProps={{ timeline: null }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
