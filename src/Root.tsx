import React from "react";
import { Composition } from "remotion";
import sampleTimeline from "../projects/00000000-sample/timeline.json";
import { calculateMetadata, Motovlog } from "./compositions/Motovlog";
import { timelineSchema } from "./timeline/schema";

const defaultProps = timelineSchema.parse(sampleTimeline);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Motovlog"
        component={Motovlog}
        schema={timelineSchema}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
