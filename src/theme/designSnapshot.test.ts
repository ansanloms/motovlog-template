// docs/design/upstream/ に置いた Claude Design のスナップショット (画面サンプル)
// の :root と、themeCssVars が生成する CSS 変数の drift を検出する。
// スナップショットの同期手順は CLAUDE.md「Claude Design の同期」を参照。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { themeCssVars } from "./cssVars.ts";

const repoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const designPath = path.join(
  repoRoot,
  "docs/design/upstream/車載画面サンプル.dc.html",
);

// design の :root ブロック (`:root {` から対応する `}` まで) を切り出す。
// ブロック内に他のルールは無い前提だが、念のため波括弧の深さで対応を取る。
const extractRootBlock = (html: string): string => {
  const startMarker = ":root {";
  const startIndex = html.indexOf(startMarker);

  if (startIndex === -1) {
    throw new Error("design の HTML に `:root {` が見つからない");
  }

  const bodyStart = startIndex + startMarker.length;
  let depth = 1;
  let i = bodyStart;

  for (; i < html.length && depth > 0; i++) {
    if (html[i] === "{") {
      depth++;
    } else if (html[i] === "}") {
      depth--;
    }
  }

  if (depth !== 0) {
    throw new Error("design の `:root {` に対応する `}` が見つからない");
  }

  return html.slice(bodyStart, i - 1);
};

// `/* ... */` コメントを除去し、`--name: value;` を key (`--` 付き) → value
// (前後の空白を trim しただけの生の文字列) の map に集める。
const parseCssVars = (block: string): Record<string, string> => {
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
  const vars: Record<string, string> = {};

  for (const match of withoutComments.matchAll(pattern)) {
    vars[match[1]] = match[2].trim();
  }

  return vars;
};

// 値の書式の流儀違い (space の有無等) を吸収するための正規化。
// 例: design の `rgba(0,0,0,0.82)` とローカルの `rgba(0, 0, 0, 0.82)`。
const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, "");

// リポジトリは `@remotion/google-fonts` の `loadFont()` が返す family 名を
// 使い、design の `'Noto Sans JP', sans-serif` とは書式が違うため除外する。
const excludedKeys = ["--font"];

// デザイン側と食い違うが、反映できない変数。値は理由。反映したらここから外す
// (CLAUDE.md「Claude Design の同期」の同期手順を参照)。
const pending: Record<string, string> = {
  "--accent-rgb": "デザインのパレット切り替え専用。リポジトリでは使わない。",
  "--note":
    "サンプルの :root は 24px だがサンプル本文の注釈は 28px で、サンプル内で矛盾している。リポジトリは本文の 28px を採る。",
};

const html = fs.readFileSync(designPath, "utf-8");
const designVars = parseCssVars(extractRootBlock(html));
const localVars = themeCssVars("Noto Sans JP");

describe("design/upstream との drift", () => {
  it("design の :root から CSS 変数が読み取れる", () => {
    expect(Object.keys(designVars).length).toBeGreaterThan(0);
    expect(designVars).toHaveProperty("--bg");
  });

  it("pending・除外を除き、design の値とローカルの値が一致する", () => {
    const mismatches: string[] = [];

    for (const [key, designValue] of Object.entries(designVars)) {
      if (excludedKeys.includes(key) || key in pending) {
        continue;
      }

      const localValue = localVars[key];

      if (
        localValue === undefined ||
        normalize(localValue) !== normalize(designValue)
      ) {
        mismatches.push(
          `${key}: design="${designValue}" local="${localValue ?? "(無し)"}"`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("pending が鮮度を保っている (デザインに存在し、まだ差分がある)", () => {
    const missingInDesign = Object.keys(pending).filter(
      (key) => !(key in designVars),
    );

    // design から無くなった変数が pending に残っている (古い pending)。
    expect(missingInDesign).toEqual([]);

    const resolved = Object.entries(pending)
      .filter(([key]) => key in designVars)
      .filter(([key]) => {
        const localValue = localVars[key];
        return (
          localValue !== undefined &&
          normalize(localValue) === normalize(designVars[key])
        );
      })
      .map(([key]) => key);

    // 値が一致するようになっていたら pending から外せ。
    expect(resolved).toEqual([]);
  });
});
