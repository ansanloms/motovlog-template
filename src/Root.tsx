import React from "react";
import { Composition } from "remotion";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog";
import { sampleTimeline } from "./data/sample";
import { timelineSchema } from "./timeline/schema";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Motovlog"
        component={Motovlog}
        schema={timelineSchema}
        defaultProps={sampleTimeline}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
