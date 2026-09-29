import React from "react";
import { Annotation } from "../../src/components/Annotation.tsx";

/** Annotation の要素ファクトリ。 */
export const annotation = (props: React.ComponentProps<typeof Annotation>) => (
  <Annotation {...props} />
);
