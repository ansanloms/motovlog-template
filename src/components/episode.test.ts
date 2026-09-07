import { describe, expect, it } from "vitest";
import { episodeBadge, episodeHeader } from "./episode";

describe("episodeBadge", () => {
  it("road があれば地名の後に付ける", () => {
    expect(episodeBadge({ number: 12, area: "愛媛", road: "国道378号" })).toBe(
      "#12 愛媛 / 国道378号",
    );
  });

  it("road が無ければ地名だけになる", () => {
    expect(episodeBadge({ number: 0, area: "福島" })).toBe("#0 福島");
  });
});

describe("episodeHeader", () => {
  it("road の有無によらず番号と地名だけになる", () => {
    expect(episodeHeader({ number: 12, area: "愛媛", road: "国道378号" })).toBe(
      "EP.12 / 愛媛",
    );
    expect(episodeHeader({ number: 0, area: "福島" })).toBe("EP.0 / 福島");
  });
});
