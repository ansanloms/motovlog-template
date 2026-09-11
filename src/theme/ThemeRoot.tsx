import React from "react";
import { AbsoluteFill } from "remotion";
import { fontFamily } from "../fonts.ts";
import { getSetup } from "../setup.ts";
import { themeCssVars } from "./cssVars.ts";

/** ThemeRoot の props。 */
type Props = {
  /** テーマの CSS 変数を受け取る子孫。 */
  children: React.ReactNode;
  /** AbsoluteFill に併せて適用する追加の style。テーマの CSS 変数を上書きしてよい。 */
  style?: React.CSSProperties;
};

/**
 * composition・gallery のルートに 1 回だけ置き、テーマの CSS 変数を AbsoluteFill
 * の style として流し込む。子孫の CSS は var(--...) でこれを参照する。
 */
export const ThemeRoot: React.FC<Props> = ({ children, style }) => {
  return (
    <AbsoluteFill
      style={
        {
          ...themeCssVars(getSetup().theme.palette, fontFamily),
          ...style,
        } as React.CSSProperties
      }
    >
      {children}
    </AbsoluteFill>
  );
};
