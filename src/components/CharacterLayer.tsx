import React from "react";
import type { Timeline } from "../timeline/schema";

type Props = {
  segments: Timeline["characterSegments"];
};

// 立ち絵表示区間の枠のみ。中身の描画は issue #3 で実装する。
// 現状は Sequence すら出さないプレースホルダ (props と型は将来の実装のため維持)。
export const CharacterLayer: React.FC<Props> = ({ segments }) => {
  void segments;

  return null;
};
