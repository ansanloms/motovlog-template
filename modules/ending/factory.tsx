import React from "react";
import { Ending } from "./Ending.tsx";

/** Ending の要素ファクトリ。 */
export const ending = (props: React.ComponentProps<typeof Ending>) => (
  <Ending {...props} />
);
