import React from "react";
import { Chapter } from "./Chapter.tsx";
import { joinLines } from "../core/index.ts";
import type { TextLines } from "../core/index.ts";

/** Chapter の要素ファクトリ。title は文字列の配列でも書け、改行で結合する。 */
export const chapter = ({
  title,
  ...props
}: Omit<React.ComponentProps<typeof Chapter>, "title"> & {
  title: TextLines;
}) => <Chapter {...props} title={joinLines(title)} />;
