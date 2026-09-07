import React from "react";
import { Composition } from "remotion";
import { z } from "zod";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog";
import { voicedTimelineSchema } from "./timeline/schema";

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
