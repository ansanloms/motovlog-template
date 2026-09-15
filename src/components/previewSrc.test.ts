import { describe, expect, it } from "vitest";
import { previewSrc } from "./previewSrc.ts";

describe("previewSrc", () => {
  it(".mp4 の src を .preview.mp4 に変える", () => {
    expect(previewSrc("clip.mp4")).toBe("clip.preview.mp4");
  });

  it(".mp4 以外の src はそのまま返す", () => {
    expect(previewSrc("photo.jpg")).toBe("photo.jpg");
  });

  it("staticFile() のようなディレクトリ付きパスでも末尾だけ変える", () => {
    expect(previewSrc("projects/20260817-jododaira/clip1.mp4")).toBe(
      "projects/20260817-jododaira/clip1.preview.mp4",
    );
  });
});
