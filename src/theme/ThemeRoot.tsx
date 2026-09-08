import React from "react";
import { AbsoluteFill } from "remotion";
import { fontFamily } from "../fonts.ts";
import { themeCssVars } from "./cssVars.ts";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

// composition・gallery のルートに 1 回だけ置き、テーマの CSS 変数を AbsoluteFill
// の style として流し込む。子孫の CSS は var(--...) でこれを参照する。
export const ThemeRoot: React.FC<Props> = ({ children, style }) => {
  return (
    <AbsoluteFill
      style={{ ...themeCssVars(fontFamily), ...style } as React.CSSProperties}
    >
      {children}
    </AbsoluteFill>
  );
};
