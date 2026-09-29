import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { photoShowcase } from "./index.tsx";
import { PhotoShowcase } from "./PhotoShowcase.tsx";
import { Video } from "../../modules/video/index.ts";

/** 未知の値を ReactElement に絞り込む (要素で無ければ throw)。 */
const asElement = (node: unknown): ReactElement => {
  if (!isValidElement(node)) {
    throw new Error("unreachable");
  }

  return node;
};

/** ReactElement の props を任意の形にキャストする (テストの検証用)。 */
const propsOf = <T,>(element: ReactElement): T => element.props as T;

describe("photoShowcase (要素ファクトリ)", () => {
  it("fit を省略すると props に fit を含まない (既定は PhotoShowcase 側で cover)", () => {
    const element = photoShowcase({ photos: ["photo.jpg"] });

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(PhotoShowcase);
    expect("fit" in element.props).toBe(false);
  });

  it("fit: contain を渡すと props に残る", () => {
    const element = photoShowcase({ photos: ["photo.jpg"], fit: "contain" });

    expect((element.props as { fit?: string }).fit).toBe("contain");
  });
});

describe("PhotoShowcase", () => {
  it("fit 省略時、.frame の data-fit は既定で cover になる", () => {
    const tree = asElement(PhotoShowcase({ photos: ["photo.jpg"] }));
    const frame = asElement(propsOf<{ children: ReactNode }>(tree).children);
    const frameProps = propsOf<{ "data-fit": string }>(frame);

    expect(frameProps["data-fit"]).toBe("cover");
  });

  it("fit: contain を渡すと .frame の data-fit が contain になる", () => {
    const tree = asElement(
      PhotoShowcase({ photos: ["photo.jpg"], fit: "contain" }),
    );
    const frame = asElement(propsOf<{ children: ReactNode }>(tree).children);
    const frameProps = propsOf<{ "data-fit": string }>(frame);

    expect(frameProps["data-fit"]).toBe("contain");
  });

  it("video を含む photos では fit が Video の objectFit prop まで伝わる", () => {
    const tree = asElement(
      PhotoShowcase({
        photos: [{ video: "video.mp4", trimBefore: 1 }],
        fit: "contain",
      }),
    );
    const frame = asElement(propsOf<{ children: ReactNode }>(tree).children);
    const cells = propsOf<{ children: ReactNode }>(frame).children;
    const cell = asElement(
      Array.isArray(cells) ? (cells as readonly ReactNode[])[0] : cells,
    );

    // PhotoVideoCell は PhotoShowcase.tsx 内のみの非公開コンポーネントなので、
    // 関数として直接呼んで 1 段レンダーし、内部の Video 要素の props を見る。
    const cellRender = cell.type as (props: unknown) => ReactNode;
    const rendered = asElement(cellRender(cell.props));
    const video = asElement(
      propsOf<{ children: ReactNode }>(rendered).children,
    );

    expect(video.type).toBe(Video);
    expect(video.props).toEqual({
      src: "video.mp4",
      trimBefore: 1,
      volume: 0,
      objectFit: "contain",
    });
  });
});
