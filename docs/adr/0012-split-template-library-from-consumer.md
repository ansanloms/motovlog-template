---
status: accepted
date: 2026-09-11T00:00:00Z
refs: [2, 4, 5, 6, 10, 11]
tags: [layout, package, theme, boundary]
---

# ADR-0012: テンプレートを lib として切り出し、利用側が入口・theme の値・project・キャラクター・素材を持つ

## Context

このリポジトリは動画を作る機能と、動画 1 本分の値を同じ木に置いている。機能は演出の DSL・コンポーネント・compositions・theme のトークン・音声生成と変換のスクリプトで、値は project の timeline・キャラクター定義・素材・色・話者である。[ADR-0002](./0002-project-directory-layout.md) は project の定義と素材の配置を定めたが、機能と値の所有者を分けることは扱っていない。

機能の側に利用側の値が焼き込まれている箇所は次の 4 つである。

- `src/theme/voice.ts` の `narrator` (VOICEVOX のスタイル id と声質の既定値、[ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md))
- `src/theme/tokens.ts` の `palette` (T&M のカラー、[ADR-0004](./0004-define-tone-and-manner.md))
- `src/project/load.ts` の `DEFAULT_PROJECT` (サンプルの slug) と、`projects/<slug>/timeline.ts` を読む動的 import
- `src/index.ts` の `registerRoot()` (Remotion の入口)

これらの値を読む経路はブラウザと Node の両方にある。`src/effects/Stage.tsx` と `src/theme/ThemeRoot.tsx` は `palette` を読み、`src/voice/key.ts` の `resolveVoice()` は `narrator` で声質の既定を埋める。`resolveVoice()` はブラウザ側の Studio・render と、Node 側の音声生成の watcher の両方から呼ばれる。両者が同じ値を使うことで音声キャッシュの key が一致する ([ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md))。

値の受け渡しには次の制約がある。

- `narration()` は timeline.ts のモジュール評価時に動く。React のレンダリングの外であり、context からは読めない ([ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md))。
- Composition の props は JSON として渡るため、関数を載せられない ([ADR-0006](./0006-write-timeline-as-effects-dsl.md))。
- 音声生成の watcher は Node で動き、Composition も React も経由しない。

Remotion には次の仕様がある (2026-09-11 時点のドキュメント)。

- 入口は CLI 引数、`Config.setEntryPoint()`、既定の探索 (`src/index.ts` 等) の順に解決する。
- public ディレクトリは `remotion` に依存する `package.json` と同じフォルダに置く。`Config.setPublicDir()` で変更できる。
- `remotion` に依存するパッケージは `remotion` を `peerDependencies` に置く。
- `import()` の引数が静的な接頭辞を持つテンプレートリテラルであれば、バンドラが同じフォルダの一致ファイルを静的に解析してバンドルする。
- node_modules 配下の TypeScript と CSS Modules を既定のバンドラ設定が処理するかは、ドキュメントに記述が無い。

同梱のサンプル project は第三者制作の立ち絵 (VOICEVOX キャラクターの PSD から切り出した PNG) を参照している。この素材はリポジトリにコミットしない ([ADR-0002](./0002-project-directory-layout.md)) ため、clone しただけではサンプルが立ち絵を描けない。

## Decision Drivers

1. 利用側が、テンプレートの更新を取り込みながら自分の色・話者・project・キャラクター・素材を持てること
2. 機能と値の境界が機械で検査できること
3. ブラウザ (Studio・render) と Node (音声生成の watcher・素材の変換) が、同じ値を同じ経路で読めること
4. [ADR-0006](./0006-write-timeline-as-effects-dsl.md) の層の規則と、[ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) の watcher による timeline.ts の静的解析を壊さないこと
5. 同梱のサンプルが、第三者の素材を用意しなくても動くこと

## Considered Options

1. lib と利用側をディレクトリで分け、`package.json` の `exports` で公開面を限り、利用側の値をモジュール単位のレジストリ (`configure()`) で lib に渡す — 採用。公開面が `exports` に現れ、境界を lint で検査できる。レジストリはブラウザと Node のどちらからも同じ入口で読めるため、Driver 3 と 4 を同時に満たす。
2. 利用側の値を Composition の props で渡す — 却下。props には関数 (timeline の loader) を載せられず、Node で動く watcher には props が届かない。
3. 利用側の値を React の context で配る — 却下。`narration()` はモジュール評価時に値が要るため context の外におり、Node 側でも使えない。
4. テンプレートを git submodule として利用側リポジトリに取り込む — 却下。公開面が定義されず、利用側が submodule の中の任意のファイルを import できる。依存の解決とバージョンの更新も npm と二重になる。
5. 同一リポジトリのまま `template/` と `works/` にディレクトリを分ける — 却下。分離の宣言がディレクトリ名だけになり、外部のリポジトリから使う道が残らない。
6. 現状の構成を保ち、サンプルの素材だけを自作のものに差し替える — 却下。色と話者が lib に焼き込まれたままで、利用側が自分の値を持てない。

## Decision

### 境界

- lib と利用側を次のとおり分ける。

  | 側     | ディレクトリ                                                                          | 内容                                                                                            |
  | ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
  | lib    | `src/`、`scripts/` (`scripts/migrate/` を除く)                                        | 演出の DSL・コンポーネント・compositions・theme の layout と timing・音声生成と変換のスクリプト |
  | 利用側 | `app/`、`theme/`、`projects/`、`characters/`、`public/`、`remotion.config.ts`、`.env` | 入口・パレットと既定話者・project 定義・キャラクター定義・素材・Remotion の設定                 |

- `scripts/migrate/` は 1 回限りの移行スクリプトの置き場とし、lib の公開面にも配布物にも含めない。
- lib の公開面を `package.json` の `exports` で次の 5 入口に限る。

  | 入口                             | 実体                        |
  | -------------------------------- | --------------------------- |
  | `motovlog-template`              | `src/index.ts`              |
  | `motovlog-template/effects`      | `src/effects/index.ts`      |
  | `motovlog-template/components`   | `src/components/index.tsx`  |
  | `motovlog-template/compositions` | `src/compositions/index.ts` |
  | `motovlog-template/theme`        | `src/theme/index.ts`        |

- `remotion`・`@remotion/*`・`react`・`react-dom` を `peerDependencies` に置き、同じ範囲を `devDependencies` にも置く。
- `package.json` の `private: true` を保つ。npm レジストリには publish しない。
- CLI の実行ファイル (`bin`) は作らない。スクリプトは `tsx scripts/<name>.ts` で実行する。
- このリポジトリ内の利用側ファイル (`app/`・`theme/`・`projects/`・`characters/`) は、bare specifier ではなく相対パスで lib を import する。ESLint で、これらのディレクトリから import できる `src/` 配下を上表の 5 入口のファイルに限る。
- `characters/<name>.ts` だけは例外とし、5 入口ではなく実体の `src/compositions/character.ts` を直に import する。ESLint はこのファイルだけを許し、5 入口と bare specifier (`motovlog-template`・`motovlog-template/*`) を禁じる。理由: 入口は `figure()`・`line()` 伝いに `src/components` と CSS Modules を辿るため `characters/<name>.ts` を素の Node から import できなくなり、このファイルを動的 import して声質を読む音声生成の watcher が、[ADR-0011](./0011-draw-figure-from-character-presets-linked-by-speech.md) の前提「`characters/<name>.ts` は Node で import できる純粋な値のモジュール」を使えなくなる。
- 外部のリポジトリから `motovlog-template` を依存として使う経路は、この決定では公開面の形だけを定める。node_modules 配下の TypeScript と CSS Modules がバンドルされるか、`Config.overrideBundlerConfig()` が要るかの検証は含めない。外部リポジトリからの依存の検証は別途行う。

### 利用側の値を lib に渡す仕組み

- lib に `src/setup.ts` を置き、`configure({ theme, loadTimeline, defaultProject })` と `getSetup()` を公開する。利用側の入口が `configure()` を 1 回呼び、lib の内部は `getSetup()` で読む。`configure()` を呼ぶ前に `getSetup()` を呼ぶと、どこで `configure()` を呼ぶかを示すメッセージで throw する。
- `Theme` 型は `{ palette, narrator }` の 2 つとする。`palette` は T&M のカラー、`narrator` は既定の話者と声質。
- `paletteRgb` (rgba() の合成用) は利用側に持たせず、lib が `palette` から導出する。
- [ADR-0005](./0005-fix-look-in-theme-not-timeline.md) の見た目のトークンのうちパレットと、[ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) の既定の話者 `narrator` は、値の置き場を利用側の `theme/index.ts` に移す。参照の形は変えず、コンポーネントは `src/theme` から読み、CSS 変数は `ThemeRoot` が流す。
- [ADR-0010](./0010-build-narration-timeline-with-hashed-voice-cache.md) の `DEFAULT_PROJECT` は `app/config.ts` の `defaultProject` に移す。`narration()` の slug の既定が `REMOTION_PROJECT` の解決に落ちる点は変えない。
- 配置 (layout) と秒数 (timing) のトークンは lib の `src/theme/` に残し、利用側には出さない。
- 利用側は次のファイルを持つ。

  | ファイル             | 内容                                                                     |
  | -------------------- | ------------------------------------------------------------------------ |
  | `theme/index.ts`     | `palette` と `narrator` の値、および `theme: Theme`                      |
  | `app/config.ts`      | `theme` と `defaultProject` (既定の slug)。Remotion を import しない     |
  | `app/index.ts`       | Temporal polyfill の読み込み、`configure()` の呼び出し、`registerRoot()` |
  | `remotion.config.ts` | `Config.setEntryPoint("./app/index.ts")`                                 |

- `app/config.ts` は Remotion を import しない。理由: 音声生成の watcher (Node) が同じファイルを `import()` して `configure()` するため。
- timeline の読み込みは利用側が `loadTimeline(slug)` として渡す。lib は渡された関数の戻り値を検査してから使い、`projects/` への import を自分では書かない。
- lib の `src/index.ts` は `registerRoot()` を呼ばず、公開面 (effects・components・compositions・theme・`configure`・`RemotionRoot`・`Motovlog`) の再 export だけを行う。`registerRoot()` は利用側の `app/index.ts` が呼ぶ。
- Node で動くスクリプト (音声生成・素材の変換・dev) は、利用側のルートを `process.cwd()` とし、`projects/`・`characters/`・`public/`・`.env` をそこから引く。
- 音声生成の watcher は起動時に `<cwd>/app/config.ts` を動的 import し、その値で `configure()` を呼ぶ。lib から利用側への参照はこの 1 か所に限り、実行時の cwd から解決する。

### サンプル

- 同梱のサンプル project が使う立ち絵は、自作の SVG placeholder を `public/assets/characters/sample/` に置き、`.gitignore` の否定パターンでコミットする。`characters/sample.ts` がこれを参照する。
- サンプルの ED のクレジットは、`theme/index.ts` の `narrator` に対応する VOICEVOX の行だけを持つ。第三者の立ち絵のクレジットは持たない。
- 第三者のキャラクター名は lib のコード・コメント・テストのフィクスチャに書かない。

## Consequences

### 利点

- 利用側が自分のリポジトリで色・話者・project・キャラクター・素材を持ち、lib の更新を依存の更新として受け取れる。
- lib が読む利用側の値が `configure()` の引数に集まり、どの値が利用側のものかが型で分かる。
- 公開面が `exports` と ESLint の 2 か所で宣言され、境界の侵犯が lint で落ちる。
- サンプルが第三者の素材なしで動き、clone した直後に Studio と render を試せる。

### 代償

- 利用側の入口で `configure()` を呼ばないと lib が動かない。呼び忘れは実行時の throw でしか分からない。
- 値の経路が 1 段増える。lib のコードは `palette`・`narrator` を直接 import せず `getSetup()` を経由するため、参照の追跡が 1 ホップ長くなる。
- ブラウザと Node で `configure()` の呼び出し元が別 (`app/index.ts` と watcher) になり、両方の設定を揃える責任が利用側に残る。
- `peerDependencies` にした分、利用側が `remotion` と `react` のバージョンを自分で合わせる必要がある。
- 同じリポジトリに lib と利用側が同居する間は、境界の検査が ESLint の設定だけに依存する。

### 禁止事項

- lib (`src/`・`scripts/`) が `app/`・`theme/`・`projects/`・`characters/` を静的に import すること。実行時の cwd から `app/config.ts` を動的に読む Node スクリプトの起点だけが例外で、これは Decision に書いた 1 か所に限る。
- 利用側 (`app/`・`theme/`・`projects/`・`characters/`) が、`exports` の 5 入口以外の `src/` 配下のファイルを import すること。`characters/<name>.ts` から `src/compositions/character.ts` を import することだけが例外で、この 1 ファイル以外には広げない。
- `characters/<name>.ts` が 5 入口または bare specifier で lib を import すること。理由: 素の Node から読めなくなり、音声生成の watcher が声質を読めなくなる。
- lib に既定のパレット・既定の話者の値を持つこと。lib が持てるのは型と、`palette` から導出する値に限る。
- lib に `projects/` や `characters/` への import (静的・動的を問わない) を書くこと。
- `app/config.ts` から Remotion を import すること。
- `scripts/migrate/` を `exports` または `files` に含めること。

## Assumptions

| 前提                                                                                     | 状態   | 確認方法 / 結果                                                                        |
| ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `Config.setEntryPoint("./app/index.ts")` で入口が `app/index.ts` になる                  | 検証済 | `npx remotion render Motovlog` を引数無しで実行して確認 (2026-09-11)                   |
| node_modules 配下の TypeScript と CSS Modules を Remotion の既定のバンドラ設定が処理する | 未検証 | 外部リポジトリから依存として読み込み、Studio と render が通るかを確認する              |
| パッケージ自己参照 (自リポジトリ内から `motovlog-template` を import) を解決できる       | 未検証 | 利用側ファイルの import を bare specifier に変えて Studio と render が通るかを確認する |
| 配置 (layout) と秒数 (timing) のトークンは lib に固定したままで利用側の要求を満たす      | 未検証 | 2 本目以降の project を作る際に、これらを利用側で変えたい場面が出るかを確認する        |

## References

- https://www.remotion.dev/docs/terminology/entry-point : 入口の解決順と `Config.setEntryPoint()`。
- https://www.remotion.dev/docs/staticfile : public ディレクトリの位置と `Config.setPublicDir()`。
- https://www.remotion.dev/docs/version-mismatch : `remotion` に依存するパッケージは `peerDependencies` に置く。
- https://www.remotion.dev/docs/webpack-dynamic-imports : 静的な接頭辞を持つ `import()` のバンドル。
- https://www.remotion.dev/docs/bundlers : バンドラの既定設定と `Config.overrideBundlerConfig()`。
- ユーザの決定 (2026-09-11): このリポジトリを外部から lib として import できる体裁にし、theme (パレット・話者) と project を利用側に出す。配置と秒数のトークンは lib に残す。
