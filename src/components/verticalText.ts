// 縦書き用に、文字列を通常表示 (text) と縦中横 (tcy) の断片へ分ける。
// 2〜3 桁の数字だけを縦中横の対象にする (4 桁以上の数字は年号等なので正立の
// まま扱う、1 桁は正立でも読めるので対象にしない)。前後が数字に接している
// 部分 (4 桁以上の数字の一部) を誤って拾わないよう、前後に数字が無い
// (2〜3 桁ぴったりの) 数字の並びだけにマッチさせる。
const tcyPattern = /(?<!\d)\d{2,3}(?!\d)/g;

/** splitForVertical が返す断片の種別。text は正立表示、tcy は縦中横表示。 */
export type VerticalTextPart = {
  kind: "text" | "tcy";
  value: string;
};

/**
 * 縦書き注釈のテキストを、通常表示 (text) と 2〜3 桁の数字 (tcy) の断片に
 * 分ける。呼び出し側は tcy の断片だけ `text-combine-upright` を当てて描く。
 */
export const splitForVertical = (text: string): VerticalTextPart[] => {
  const parts: VerticalTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(tcyPattern)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    parts.push({ kind: "tcy", value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return parts;
};
