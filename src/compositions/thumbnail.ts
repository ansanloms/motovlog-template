// timeline.ts が OP・サムネ用フレームの絵を書くための要素ファクトリ
// (ADR-0011)。src/components/index.tsx の他の要素ファクトリと違い、ここに
// 置くのは character (character() の戻り値) と expression (表情名) を
// figureLayers() で staticFile() 済みの URL 列に解決するため。ADR-0011 の
// 禁止事項 (src/components が表情名を知ること) により、表情名の解決は
// effects と components の両方を import できる層 (compositions) に置き、
// Thumbnail には解決済みの URL 列だけを渡す。

import { createElement } from "react";
import type { ReactElement } from "react";
import { Thumbnail } from "../components/Thumbnail.tsx";
import type { Character } from "./character.ts";
import { figureLayers } from "./figure.ts";

/**
 * OP・サムネ用フレームの絵の要素を組み立てる。photo・badge・title は
 * Thumbnail にそのまま渡す。character は characters/<name>.ts の
 * character() の戻り値、expression は初期の表情名 (省略時は expressions の
 * 最初のキー)。サムネは 1 フレームの静止画として使うため、figure() と違い
 * 目パチ・口パクはせず、figureLayers() で開眼・無音の口 ("n") に固定した
 * レイヤー列を Thumbnail の character prop に渡す。
 */
export const thumbnail = (options: {
  readonly photo: string;
  readonly badge: string;
  readonly title: string;
  readonly character: Character;
  readonly expression?: string;
}): ReactElement =>
  createElement(Thumbnail, {
    photo: options.photo,
    badge: options.badge,
    title: options.title,
    character: figureLayers(options.character, options.expression),
  });
