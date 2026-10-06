import React from "react";
import { PhotoShowcase } from "./PhotoShowcase.tsx";

/** PhotoShowcase の要素ファクトリ。 */
export const photoShowcase = (
  props: React.ComponentProps<typeof PhotoShowcase>,
) => <PhotoShowcase {...props} />;
