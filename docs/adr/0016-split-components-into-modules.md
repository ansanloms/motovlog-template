---
status: accepted
date: 2026-09-30T00:00:00Z
refs: [6, 11, 12, 14, 15]
tags: [layout, package, components, boundary]
---

# ADR-0016: コンポーネントを modules/<name>/ に分け、共有部品を modules/core/ に置く

## Context

lib の見た目のコンポーネントは `src/components/` に平らに置かれている。コンポーネント本体 (`Chapter.tsx` 等)・CSS Module・テストと、共有の部品が同じディレクトリに並ぶ。共有の部品は `text.ts`・`volume.ts`・`previewSrc.ts` である。要素ファクトリ (`chapter()`・`video()` 等) は `src/components/index.tsx` に集まっている。音量の率を配る context は `src/fadeGain.ts` にあり、`src/effects/Stage.tsx` と `src/components/volume.ts` の両方が読む。

`src/components/` と `src/fadeGain.ts` は 28 ファイル・計 1365 行 (2026-09-30 時点) である。

`src/effects`・`src/compositions`・`src/theme`・`src/voice`・`src/project` は、timeline の DSL・発話と立ち絵の組み立て・トークン・音声・project の読み込みを担う層で、[ADR-0006](./0006-write-timeline-as-effects-dsl.md) と [ADR-0012](./0012-split-template-library-from-consumer.md) の ESLint の規則で層の境界を検査している。`src/components/**` には、effects を import しないこと、`remotion` から import できる名前を限ることの規則がある。

[ADR-0015](./0015-move-library-to-motovlog-repository.md) により、lib は利用側リポジトリから GitHub 参照の依存として使われる。

## Decision Drivers

1. 1 つのコンポーネントに属するファイル (本体・CSS Module・要素ファクトリ・テスト) を 1 か所で読み書きできること
2. コンポーネント同士の依存を、共有部品を経由するものに限って機械で検査できること
3. 既存の公開面 (`motovlog/components`) を使う利用側を壊さないこと
4. 構成の変更に伴う検証のコストが、対象のコード量に見合うこと

## Considered Options

1. `src/components/` の中身だけを `modules/<name>/` に分け、共有部品を `modules/core/` に置き、単一の `package.json` の `exports` に `./modules/*` を足す — 採用。コンポーネント単位でファイルがまとまり、依存の規則を ESLint で書ける。パッケージの構成とバンドラの設定は変わらない。
2. npm workspaces で module ごとにパッケージを分ける — 却下。約 1365 行のコードのために、Remotion のバンドラが workspace のパッケージと CSS Modules を解決するか、パッケージの自己参照が通るかを検証し直す必要があり、コストが見合わない。
3. `src/effects`・`src/compositions` も `modules/` に移す — 却下。これらはコンポーネントではなく層の DSL で、[ADR-0006](./0006-write-timeline-as-effects-dsl.md) と [ADR-0012](./0012-split-template-library-from-consumer.md) の層の規則がディレクトリ単位で書かれている。移しても 1 か所にまとまるファイルが増えず、層の境界の検査を書き直すことになる。
4. 現状の `src/components/` を保つ — 却下。コンポーネント間の依存と共有部品への依存が区別されず、Driver 2 を満たさない。

## Decision

### 配置

- `src/components/` の中身を `modules/` に移す。`src/effects`・`src/compositions`・`src/theme`・`src/voice`・`src/project` は `src/` に残す。
- `modules/core/` に module 間で共有する部品を置く。`src/fadeGain.ts` と、`src/components/` の `text.ts`・`volume.ts`・`previewSrc.ts` とそのテストをここに置く。
- 次の module を置く。

  | module                    | 中身                                                   |
  | ------------------------- | ------------------------------------------------------ |
  | `modules/chapter/`        | `Chapter` と `chapter()`                               |
  | `modules/ending/`         | `Ending` と `ending()`                                 |
  | `modules/photo-showcase/` | `PhotoShowcase` と `photoShowcase()`                   |
  | `modules/thumbnail/`      | `Thumbnail`                                            |
  | `modules/figure/`         | `Figure`                                               |
  | `modules/subtitle/`       | `Line`・`Subtitle`・`SubtitleBand` と `subtitleBand()` |
  | `modules/annotation/`     | `Annotation` と `annotation()`                         |
  | `modules/video/`          | `Video` と `video()`                                   |
  | `modules/audio/`          | `Audio` と `audio()`                                   |

- 各 module は、コンポーネント本体・CSS Module・要素ファクトリ・テストを同じディレクトリに置く。
- 各 module の入口は `modules/<name>/index.ts` とし、その module の要素ファクトリとコンポーネントを export する。
- `thumbnail()` と `figure()` は表情名とキャラクター定義の解決を伴うため、[ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md) と [ADR-0014](./0014-nest-timeline-groups-and-place-narration-as-group.md) のとおり `src/compositions/` に置き、module には置かない。

### 公開面

- `package.json` の `exports` に `"./modules/*": "./modules/*/index.ts"` を足し、`files` に `modules` を足す。
- `src/components/index.tsx` は `modules/*` の要素ファクトリを再 export するだけのファイルにし、`exports` の `./components` を保つ。
- npm workspaces は使わず、`package.json` は 1 つとする。

### 依存の規則

- `src/components/**` に課していた ESLint の規則 (effects を import しない、`remotion` から import できる名前を限る、`@remotion/media` 以外の `@remotion/*` を import しない、利用側を import しない) を `modules/**` にも課す。加えて `modules/**` は compositions を import しない。
- `modules/<name>/` が import してよい他の module は `modules/core/` だけとする。`modules/core/` は他の module を import しない。
- 利用側 (`app/`・`theme/`・`projects/`) が import してよい module のファイルは `modules/<name>/index.ts` だけとする。`characters/<name>.ts` は module を import しない。

## Consequences

### 利点

- 1 つのコンポーネントを変えるときに読むファイルが 1 つのディレクトリに収まる。
- module 間の依存が `modules/core/` 経由に限られ、違反が lint で落ちる。
- 利用側は `motovlog/modules/<name>` で必要な module だけを import でき、既存の `motovlog/components` もそのまま使える。

### 代償

- 公開面が `motovlog/components` と `motovlog/modules/<name>` の 2 通りになり、同じ要素ファクトリを 2 つの経路で import できる。
- module 間の依存の規則は、module の名前ごとに ESLint の設定ブロックを生成して検査する。module を足すと設定が増え、規則は import 文の文字列の前方一致による近似になる。
- 他の module のコンポーネントを使いたい場合 (例: 写真紹介が走行映像の `Video` を使う) は、その部品を `modules/core/` に移すか、依存の規則を見直す必要がある。

### 禁止事項

- `modules/<name>/` が `modules/core/` 以外の module を import すること。
- `modules/core/` が他の module を import すること。
- `modules/**` が `src/components/index.tsx` を import すること。理由: 全 module の要素ファクトリを再 export するため、経由すると他の module への依存と循環 import が生じる。
- `modules/**` が `src/effects`・`src/compositions`・利用側 (`app/`・`theme/`・`projects/`・`characters/`) を import すること。
- module ごとに `package.json` を置き、npm workspaces に分けること。
- 利用側が `modules/<name>/index.ts` 以外の module のファイルを import すること。

## Assumptions

| 前提                                                                                    | 状態   | 確認方法 / 結果                                                                                   |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `exports` の `./modules/*` のパターンを、利用側の Node と Remotion のバンドラが解決する | 未検証 | 利用側リポジトリで `motovlog/modules/<name>` を import し、tsc・Studio・render が通るかを確認する |
| module 間で共有する部品が `modules/core/` に収まる                                      | 未検証 | 各コンポーネントを module に移すときに、`modules/core/` 以外の module への依存が要るかを確認する  |

## References

- 2026-09-30 の計画承認: `src/components/` の中身だけを `modules/<name>/` に分け、共有部品を `modules/core/` に置く。npm workspaces は使わず、`package.json` の `exports` に `./modules/*` を足す。`src/effects` と `src/compositions` は `src/` に残す。
