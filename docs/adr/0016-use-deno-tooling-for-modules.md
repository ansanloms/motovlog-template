---
status: accepted
date: 2026-10-01T00:00:00Z
refs: [12, 15]
tags: [tooling, deno, test, lint, modules]
---

# ADR-0016: modules/ の型検査・lint・整形・純粋なロジックのテストを Deno で行う

## Context

[ADR-0015](./0015-split-components-into-modules.md) により、`modules/<name>/` は npm package 相当の独立した単位として置かれる。リポジトリの開発ツールはすべて Node 上で動いている。型検査は `tsc`、lint は ESLint、整形は prettier、テストは vitest で、Remotion の bundle と render は Remotion CLI で行う。

ESLint は [ADR-0012](./0012-split-template-library-from-consumer.md) と [ADR-0015](./0015-split-components-into-modules.md) の層と module の境界を、import の制限の規則で検査している。`modules/` のコンポーネントは CSS Modules (`*.module.css`) を import する。そのテスト (`.test.tsx`) も、コンポーネントを通じて CSS Modules を読む。

`modules/` に対して deno 2.9.6 で次を確認した (2026-10-01)。

- `deno check modules/` は、`compilerOptions.lib` に `"dom"`・`"dom.iterable"`・`"esnext"` を指定すると通る。指定しない場合は `TS2503 Cannot find namespace 'Temporal'` が 4 件出る。
- `deno lint modules/` の指摘は 0 件だった。`deno fmt --check modules/` では 23 ファイル中 1 ファイル (`modules/core/volume.test.ts`、末尾カンマ) が差分になった。
- vitest で書いたテストを `deno test` で実行すると `Cannot read properties of undefined (reading 'config')` で失敗する。import 行だけを `@std/testing/bdd` と `@std/expect` に替えると、`modules/core/volume.test.ts` と `modules/core/previewSrc.test.ts` は本文を変えずに通る。Temporal の polyfill は不要だった。
- `*.module.css` を実行時に import するモジュールは `deno test` で読めず、`Expected a JavaScript or TypeScript module, but identified a Css module. Importing these types of modules is currently not supported.` で失敗する。
- `deno lint --rules` の規則一覧には、ESLint の `no-restricted-imports` のように import 先をパスで制限する規則が無い。

## Decision Drivers

1. 所有者は自分の開発ツールに Deno を使っており、このリポジトリのツールも Deno に寄せたい
2. 既存の検査 (層と module の境界、React hooks の規則、CSS Modules を読むテスト、Remotion の bundle と render) を失わないこと
3. Deno と Node で同じ依存のバージョンを解決すること

## Considered Options

1. `modules/` の型検査・lint・整形・純粋なロジックのテストだけを Deno で行い、それ以外は Node に残す — 採用。Deno で動くことを確認した範囲だけを移し、Deno で代替できない検査は Node に残せる。
2. すべてのツールを Deno に移す — 却下。CSS Modules を実行時に import できず (`Importing these types of modules is currently not supported.`)、コンポーネントのテストが動かない。import 先をパスで制限する lint 規則が無く、境界の検査を失う。
3. CSS Modules をやめ、コンポーネントのテストも Deno で動かす — 却下。スタイルの当て方が変わる別の決定であり、この ADR の範囲を超える。
4. Remotion CLI も Deno で動かす — 却下。所有者の計画で Remotion の対応範囲外として扱った。Deno での動作は試していない。

## Decision

### Deno が受け持つ範囲

- `modules/` の型検査を `deno check modules/` で行う。
- `modules/` の lint を `deno lint`、整形を `deno fmt` で行う。対象は `deno.json` の `lint.include`・`fmt.include` で `modules/` に限る。
- `modules/**/*.test.ts` (CSS Modules を読まないテスト) を `deno test` で実行する。対象は `deno.json` の `test.include` で決める。テストは `@std/testing/bdd` と `@std/expect` で書く。
- これらは `deno.json` の `tasks` (`check`・`lint`・`fmt`・`fmt:check`・`test`) として定義し、`npm run lint` と `npm run fix` から呼ぶ。

### Node に残す範囲

- Remotion の bundle と render、Studio は Node 上の Remotion CLI で行う。
- `tsc` はリポジトリ全体を型検査する。`modules/**/*.test.ts` は `tsconfig.json` の `exclude` に入れる。理由: `tsc` は `@std/*` を解決できない。
- ESLint は `modules/**` も含めてこれまでどおり実行する。境界の規則と React hooks の規則は ESLint だけが受け持つ。
- `modules/**/*.test.tsx` (CSS Modules を読むテスト) は vitest で実行する。vitest は `modules/**/*.test.ts` を対象から外す。
- prettier は `modules/` を対象にしない。
- `src/`・`scripts/`・`app/`・`theme/`・`test/` のツールは変えない。

### 依存のバージョン

- `deno.json` の `nodeModulesDir` は `"manual"` とし、npm の依存は `npm ci` が作った `node_modules` から解決する。
- `deno.json` の `imports` に書く npm パッケージ (`react`・`react-dom`・`remotion`・`@remotion/media`) のバージョンは、`package.json` と同じ版に固定する。
- `deno.lock` をコミットする。

## Consequences

### 利点

- `modules/` の純粋なロジックの型検査・lint・整形・テストを、所有者が普段使う Deno のツールで回せる。
- 境界の検査・コンポーネントのテスト・Remotion の bundle と render は、これまでと同じ Node のツールで動き続ける。

### 代償

- 同じ `modules/` に対して 2 つのツールチェーン (Deno の型検査・lint と、Node の `tsc`・ESLint) が走る。
- テストの書き方が 2 通りになる。`modules/` の `.test.ts` は `@std/testing/bdd`、`.test.tsx` とそれ以外のディレクトリのテストは vitest で書く。
- 整形のツールがディレクトリで分かれる。`modules/` は `deno fmt`、それ以外は prettier である。
- `src/` 等から `modules/` へ移すテストは、`.test.ts` であれば `@std/testing/bdd` と `@std/expect` に書き換える必要がある。
- Remotion 等の依存を更新するときは、`package.json` と `deno.json` の両方のバージョンを揃える必要がある。

### 禁止事項

- `modules/**/*.test.ts` を vitest で書くこと、または CSS Modules を読むテストを `.test.ts` として置くこと。
- `deno.json` の `imports` に `package.json` と異なるバージョンを書くこと。
- `modules/` に対する ESLint の境界の規則を、Deno の lint で置き換えたとして外すこと。
- `modules/` を prettier で整形すること。

## Assumptions

| 前提                                                                  | 状態   | 確認方法 / 結果                                                                                     |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `deno fmt` と prettier の整形結果の差は末尾カンマ程度に留まる         | 検証済 | 2026-10-01、`deno fmt --check modules/` で差分は 23 ファイル中 1 ファイル (末尾カンマ) だった       |
| Deno が `nodeModulesDir: "manual"` で `node_modules` の依存を解決する | 検証済 | 2026-10-01、deno 2.9.6 で `deno check modules/` と `deno test` が通った                             |
| Deno が CSS Modules の実行時 import に対応しない                      | 検証済 | 2026-10-01、deno 2.9.6 で `Importing these types of modules is currently not supported.` を確認した |

## References

- 2026-10-01 の所有者の計画承認: `modules/` の型検査・lint・整形・純粋なロジックのテストを Deno で行い、Remotion の bundle と render、リポジトリ全体の `tsc`、ESLint の境界の規則、CSS Modules を読むテスト、`src/` 等は Node に残す。`deno.json` の npm パッケージのバージョンは `package.json` に揃える。
- 2026-10-01 の deno 2.9.6 での実測 (Context に記載した結果)。
