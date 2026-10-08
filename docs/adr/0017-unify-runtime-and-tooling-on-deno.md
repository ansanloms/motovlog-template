---
status: accepted
date: 2026-10-07T00:00:00Z
refs: [15, 16]
tags: [tooling, deno, remotion, test, runtime]
---

# ADR-0017: Remotion の実行と開発ツールを Deno に統一する

## Context

[ADR-0016](./0016-use-deno-tooling-for-modules.md) により、`modules/` の型検査・lint・整形・純粋なロジックのテストは Deno で行い、それ以外は Node に残している。Node に残した範囲は、Remotion CLI の bundle・render・Studio、`tsx` による `scripts/` の実行、`tsc`、ESLint、prettier、vitest である。CSS Modules を読むテスト (`.test.tsx`) と `modules/` 以外のテストは vitest で書かれている。ADR-0016 では Remotion CLI を Deno で動かす検証はしていない。

`modules/<name>/` は [ADR-0015](./0015-split-components-into-modules.md) により npm package 相当の単位として置かれている。依存は `package.json` と各 member の `deno.json` の 2 か所に書かれ、`package-lock.json` が npm 依存を固定している。

deno 2.9.7 と Remotion 4.0.529 で次を確認した (2026-10-07)。

- `deno run -A npm:@remotion/cli/remotion` の `compositions`・`bundle`・`render`・`studio` は Node と同じように動く。31 フレームの render は Node と同じ尺の動画を書き出し、Studio は約 3 秒で HTTP 200 を返した。
- `npm:@remotion/cli` (`/remotion` を付けない形) は `cli` という bin が無いため失敗する。
- `node_modules` を消すと、Remotion のバンドラ (Rspack) が bare specifier を解決できず、`Module not found: Can't resolve 'temporal-polyfill/global'` で失敗する。
- `nodeModulesDir: "auto"` と `deno install` で作った `node_modules` (`package.json` と npm を使わない) で、`compositions` と `render` が動く。
- `*.test.ts(x)` のうち CSS Modules を読むものは 4 ファイル (`src/compositions/figure.test.ts`・`src/compositions/narration.test.ts`・`src/compositions/thumbnail.test.ts`・`modules/photo-showcase/PhotoShowcase.test.tsx`) である。root の `deno.json` の `imports` で各 `./modules/<dir>/<Name>.module.css` をスタブのモジュールに割り当てると、これらは `deno test` で通る。キーは root からの相対パス (`"./modules/figure/Figure.module.css"`) で書ける。
- 型検査を有効にした `deno test` では、スタブを `Record<string, string>` で型付けする必要がある。`process` を参照するコードには Node の型が要る。
- `deno check src/index.ts app/index.ts scripts/*.ts` は、`node_modules` がある状態で通る。
- `deno lint` には、ESLint の `no-restricted-imports` のように import 先をパスで制限する規則が無い (ADR-0016)。

Remotion は Deno を公式の実行環境としていない。

## Decision Drivers

1. 所有者は自分の開発ツールに Deno を使っており、このリポジトリのツールも Deno に寄せたい
2. ツールチェーンと依存の宣言を 1 つにまとめ、Node と Deno の二重管理をやめる
3. 既存の検査 (層と module の境界、CSS Modules を読むテスト、Remotion の bundle と render) を失わない

## Considered Options

1. Remotion CLI・スクリプト・テスト・型検査・lint・整形を Deno で行い、`node_modules` は `deno install` で作る — 採用。実測で Remotion CLI が Deno で動き、CSS Modules を読むテストもスタブで動く。依存の宣言を `deno.json` にまとめられる。
2. `node_modules` も無くす — 却下。Rspack が bare specifier を `node_modules` から解決するため、bundle が `Can't resolve 'temporal-polyfill/global'` で失敗する。
3. CSS Modules を読むテストだけ vitest に残す — 却下。import map のスタブで `deno test` が通るため、テストランナーを 2 つ持つ理由が無い。
4. ADR-0016 の分担のまま Node に残す — 却下。ツールチェーンと依存の宣言が二重のまま残る。

## Decision

### Deno が受け持つ範囲

- Remotion CLI (`compositions`・`bundle`・`render`・`studio`) を `deno run -A npm:@remotion/cli/remotion` で実行する。`npm:@remotion/cli` の形では呼ばない。
- `scripts/` のスクリプトを Deno で実行する。
- テストはすべて `deno test` で実行し、`@std/testing/bdd` と `@std/expect` で書く。モックと偽の時計は `@std/testing/mock` と `@std/testing/time` を使う。vitest は使わない。
- root の `deno.json` の `test.include` に `src/`・`modules/`・`scripts/`・`theme/` のテスト (`*.test.ts`・`*.test.tsx`) を並べ、root の `deno task test` は `deno test -A` でそれらをまとめて実行する。各 member の `deno task test` は自分のテストだけを実行する。
- テストが CSS Modules を読むときは、root の `deno.json` の `imports` で `./modules/<dir>/<Name>.module.css` を `test/cssStub.ts` に割り当てる。スタブはクラス名を引くとそのキー名を返す。
- `configure()` や Temporal の polyfill が要るテストは、先頭で `test/setup.ts` を import する。
- 型検査は `deno check`、lint は `deno lint`、整形は `deno fmt` で行う。

### node_modules と依存

- `node_modules` は残す。
- `node_modules` は `deno install` で作り、root の `deno.json` は `nodeModulesDir: "auto"` にする。
- npm の依存は root の `deno.json` に exact 版で書き、`package.json`・`package-lock.json` は置かない。npm コマンドは使わない。

### ESLint

- ESLint は層と module の境界の規則のためだけに残す。同じ検査ができる `deno lint` の plugin に置き換えるまで外さない。

### 段階的な移行

- 移行は 3 段階で行う。1 段階目でテストを Deno に移し、2 段階目で型検査・lint・整形を Deno に移し、3 段階目で Remotion CLI の実行・依存の宣言・CI を Deno に移す。
- CI では Deno で `compositions` を実行し、Remotion が Deno で動くことの smoke check にする。

## Consequences

### 利点

- ツールチェーンが Deno の 1 つにまとまり、所有者が普段使うツールで開発できる。
- テストの書き方が 1 通りになる。
- 依存の宣言が `deno.json` にまとまる。

### 代償

- Remotion は Deno を公式の実行環境としていないため、Remotion の更新で Deno 上の実行が壊れることがある。CI の `compositions` で検知し、壊れたら原因を調べる必要がある。
- CSS Modules のスタブはクラス名を返すだけなので、テストからは CSS の中身を検査できない。
- CSS Modules を足すたびに、root の `deno.json` の `imports` にスタブの割り当てを足す必要がある。
- テストで `vi.resetModules()` に当たる機能が無いため、モジュールを読み直すテストは query 付きの URL (`./setup.ts?fresh=<n>`) で import し直す。
- ESLint のためだけに Node のツールが残る。

### 禁止事項

- vitest でテストを書くこと。
- `node_modules` を前提から外すこと。理由: Rspack が bare specifier を解決できなくなる。
- Remotion CLI を `npm:@remotion/cli` の形で呼ぶこと。
- CSS Modules を読むテストを、スタブの割り当てを足さずに置くこと。
- ESLint の境界の規則を、同じ検査ができる置き換えなしに外すこと。

## Assumptions

| 前提                                                                | 状態   | 確認方法 / 結果                                                                                       |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| Remotion CLI が Deno で Node と同じように動く                       | 検証済 | 2026-10-07、deno 2.9.7 と Remotion 4.0.529 で `compositions`・`bundle`・`render`・`studio` を確認した |
| `deno install` で作った `node_modules` で Rspack が依存を解決できる | 検証済 | 2026-10-07、`nodeModulesDir: "auto"` と `deno install` で `compositions` と `render` が動いた         |
| import map のスタブで CSS Modules を読むテストが `deno test` で通る | 検証済 | 2026-10-07、4 ファイルが通った                                                                        |
| Remotion の更新後も Deno 上で動き続ける                             | 未検証 | 更新のたびに CI の `compositions` で確認する                                                          |

## References

- 2026-10-07 の所有者の承認: Remotion の実行と開発ツールを Deno に統一し、Node は Deno が作る `node_modules` だけに残す。`node_modules` は Rspack のために残し、`deno install` (`nodeModulesDir: "auto"`) で作る。CSS Modules を読むテストは import map のスタブで `deno test` に移す。ESLint は境界の規則のためだけに残す。移行はテスト・開発ツール・実行環境と CI の 3 段階で行う。
- 2026-10-07 の deno 2.9.7 と Remotion 4.0.529 での実測 (Context に記載した結果)。
