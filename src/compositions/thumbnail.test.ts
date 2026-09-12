import { isValidElement } from "react";
import { staticFile } from "remotion";
import { describe, expect, it } from "vitest";
import { Thumbnail } from "../components/Thumbnail.tsx";
import { character } from "./character.ts";
import type { Character } from "./character.ts";
import { figureLayers } from "./figure.ts";
import { thumbnail } from "./thumbnail.ts";

// figure.test.ts の hero と同じ作り方 (eyes・mouth を混ぜた表情を持たせ、
// figureLayers() が開眼・無音の口に固定することを確かめられるようにする)。
const mouth = {
  mouth: {
    a: "mouth-a.png",
    i: "mouth-i.png",
    u: "mouth-u.png",
    e: "mouth-e.png",
    o: "mouth-o.png",
    n: "mouth-n.png",
  },
};

const eyes = { eyes: { open: "eyes-open.png", closed: "eyes-closed.png" } };

const hero: Character = character({
  expressions: {
    normal: ["body.png", eyes, mouth],
    sweat: ["body.png", "fx-sweat.png"],
  },
});

describe("thumbnail", () => {
  it("by: character (表情省略) は figureLayers(character) と同じ layer 列 (開眼・無音口) を Thumbnail の character prop に渡す", () => {
    const element = thumbnail({
      photo: "photo.jpg",
      badge: "#1",
      title: "title",
      by: hero,
    });

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(Thumbnail);

    const props = element.props as { character: readonly string[] };

    expect(props.character).toEqual(figureLayers(hero));
    expect(props.character).toEqual([
      staticFile("body.png"),
      staticFile("eyes-open.png"),
      staticFile("mouth-n.png"),
    ]);
  });

  it("by: { character, expression } は figureLayers(character, expression) と同じ layer 列を渡す", () => {
    const element = thumbnail({
      photo: "photo.jpg",
      badge: "#1",
      title: "title",
      by: { character: hero, expression: "sweat" },
    });

    const props = element.props as { character: readonly string[] };

    expect(props.character).toEqual(figureLayers(hero, "sweat"));
    expect(props.character).toEqual([
      staticFile("body.png"),
      staticFile("fx-sweat.png"),
    ]);
  });

  it("by が不正な形 (null) なら resolveBy() のエラーを throw する", () => {
    expect(() =>
      thumbnail({
        photo: "photo.jpg",
        badge: "#1",
        title: "title",
        by: null as unknown as Parameters<typeof thumbnail>[0]["by"],
      }),
    ).toThrow(/by は character\(\) の戻り値か/);
  });
});
