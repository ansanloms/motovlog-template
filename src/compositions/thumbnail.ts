// timeline.ts が OP・サムネ用フレームの絵を書くための要素ファクトリ
// (ADR-0011)。src/components/index.tsx の他の要素ファクトリと違い、ここに
// 置くのは by (character() の戻り値、表情は既定、か `{ character, expression? }`
// の形) を figureLayers() で staticFile() 済みの URL 列に解決するため。
// ADR-0011 の禁止事項 (src/components が表情名を知ること) により、表情名の
// 解決は effects と components の両方を import できる層 (compositions) に
// 置き、Thumbnail には解決済みの URL 列だけを渡す。

import { createElement } from "react";
import type { ReactElement } from "react";
import { Thumbnail } from "../components/Thumbnail.tsx";
import type { TextLines } from "../components/text.ts";
import { joinLines } from "../components/text.ts";
import { resolveBy } from "./character.ts";
import type { ByRef } from "./character.ts";
import { figureLayers } from "./figure.ts";

/**
 * OP・サムネ用フレームの絵の要素を組み立てる。photo・badge は Thumbnail に
 * そのまま渡す。title は文字列の配列でも書け、改行として結合してから
 * Thumbnail に渡す。by は characters/<name>.ts の character() の戻り値
 * (表情は expressions の最初のキー) か `{ character, expression }` の形
 * (表情を明示する)。サムネは 1 フレームの静止画として使うため、figure() と
 * 違い目パチ・口パクはせず、figureLayers() で開眼・無音の口 ("n") に固定
 * したレイヤー列を Thumbnail の character prop に渡す。
 */
export const thumbnail = (options: {
  /** Thumbnail に渡す走行写真の URL (staticFile 済み)。 */
  readonly photo: string;
  /** バッジ文字列 (話数等)。 */
  readonly badge: string;
  /** 地名。文字列の配列でも書け、改行として結合する。 */
  readonly title: TextLines;
  /** characters/<name>.ts の character() の戻り値、か `{ character, expression? }` の形。 */
  readonly by: ByRef;
}): ReactElement => {
  const { character, expression } = resolveBy(options.by);

  return createElement(Thumbnail, {
    photo: options.photo,
    badge: options.badge,
    title: joinLines(options.title),
    character: figureLayers(character, expression),
  });
};
