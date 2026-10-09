---
status: superseded
date: 2026-10-03T00:00:00Z
superseded-by: [18]
refs: [12, 15, 17]
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

`modules/*` を Deno の workspace の member にした構成について、deno 2.9.6 で次を確認した (2026-10-03)。

- root の `deno.json` の `"workspace": ["./modules/*"]` で、`modules/` 直下の各ディレクトリが member になる。member 同士の相対 import (`../core/index.ts`) はそのまま解決される。
- `nodeModulesDir` を member の `deno.json` に書くと `"nodeModulesDir" field can only be specified in the workspace root deno.json file` の警告が出る。
- root の `fmt`・`lint`・`test` の `include` を外すと、root で引数なしに実行した `deno fmt`・`deno lint`・`deno test` がリポジトリ全体を対象にする。
- member の `deno.json` に `name` と `exports` を書くと、`deno lint` に `jsr` タグの規則 (`no-slow-types`・`verbatim-module-syntax`) が加わり、`modules/` に 15 件の指摘が出る。root の `lint.rules.tags` を `["recommended"]` にすると 0 件に戻る。
- member は root の `tasks` を引き継ぐ。`test` を持たない member で `deno task test` を実行すると root の `test` が走る。root の `check`・`lint`・`fmt:check`・`test` を `deno task --members` にすると、その task を持たない member が root の task を呼び返し、終わらなくなる。
- テストファイルの無い member で `deno test -A` を実行すると `error: No test modules found` で終了コード 1 になる。

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

- `modules/` の型検査を、各 member の `deno task check` (`deno check index.ts`) で行う。root の `deno task check` は `deno task --members check` で全 member の `check` を実行する。
- `modules/` の lint を `deno lint`、整形を `deno fmt` で行う。lint の規則は root の `lint.rules.tags` で `recommended` に固定する。理由: member が `name` と `exports` を持つと `jsr` タグの規則が加わるが、`modules/` は JSR に publish しない。
- `modules/**/*.test.ts` (CSS Modules を読まないテスト) を `deno test` で実行する。テストは `@std/testing/bdd` と `@std/expect` で書く。
- 全 member が同じ 4 つの task (`check`・`lint`・`fmt:check`・`test`) を持つことを前提に、root の `check`・`lint`・`fmt:check`・`test` は `deno task --members` で回す。task を持たない member があると root の task を呼び返して止まらなくなるため、module を足すときは 4 つの task を必ず置く。テストの無い member は `--permit-no-files` で成功にする。
- root の `test.exclude` で `modules/**/*.test.tsx` を外す。理由: 外さないと root の `deno test -A` が CSS Modules を読む `.test.tsx` (`modules/photo-showcase/PhotoShowcase.test.tsx`) まで読み込み、`*.module.css` の import で失敗する。
- root の `tasks` (`check`・`lint`・`fmt`・`fmt:check`・`test`) を `npm run lint` と `npm run fix` から呼ぶ。

### workspace の構成

- root の `deno.json` を workspace とし、`"workspace": ["./modules/*"]` で `modules/<name>/` をすべて member にする。
- 各 member は自分の `deno.json` を module の manifest として持つ。`name` は `@motovlog/<name>`、`version` は `0.0.0`、`exports` は `./index.ts` とする。
- 依存は member の `deno.json` の `imports` に書く。その member のファイルが import する外部パッケージだけを書く。
- 各 member の `tasks` には `check` (`deno check index.ts`)・`lint` (`deno lint`)・`fmt:check` (`deno fmt --check`)・`test` (`deno test -A --permit-no-files`) を必ず置く。理由: task を持たない member があると、root の task (`deno task --members <task>`) をその member が引き継いで呼び返す。
- root の `deno.json` は `nodeModulesDir`・`compilerOptions`・`fmt`/`lint`/`test` の `include` を持つ。理由: `nodeModulesDir` は workspace の root にしか書けず、`include` が無いと root で引数なしに実行した `deno fmt`・`deno lint`・`deno test` がリポジトリ全体を対象にする。
- member 間の import と、`src/` から member への import は、member の名前 (`@motovlog/<name>`) で書く。名前が指すのは member の `exports` (`./index.ts`) だけで、member の中の他のファイルを相対パスで直に import しない。理由: member を package 相当の単位として、入口だけを介して使うため。
- Deno は名前を workspace から解決する。Remotion のバンドラ (Rspack) は `node_modules` から解決し、`deno install` は member を `node_modules` にリンクしないため、`remotion.config.ts` の `Config.overrideBundlerConfig()` で member の `deno.json` の `name` から `modules/<name>/index.ts` への alias (完全一致の `<name>$`) を足す。`overrideBundlerConfig()` は Webpack と Rspack のどちらを選んでも効く共通の override で、`Config.setRspack(true)` では `overrideWebpackConfig()` は呼ばれない。
- `deno.lock` はコミットする。理由は「依存のバージョン」に書く。

### Node に残す範囲

この節の範囲は [ADR-0017](./0017-unify-runtime-and-tooling-on-deno.md) が置き換え、すべて Deno で行う。

- Remotion の bundle と render、Studio は Node 上の Remotion CLI で行う。
- `tsc` はリポジトリ全体を型検査する。`modules/**/*.test.ts` は `tsconfig.json` の `exclude` に入れる。理由: `tsc` は `@std/*` を解決できない。
- ESLint は `modules/**` も含めてこれまでどおり実行する。境界の規則と React hooks の規則は ESLint だけが受け持つ。
- `modules/**/*.test.tsx` (CSS Modules を読むテスト) は vitest で実行する。vitest は `modules/**/*.test.ts` を対象から外す。テストの実行は [ADR-0017](./0017-unify-runtime-and-tooling-on-deno.md) が置き換え、CSS Modules を import map のスタブに割り当ててすべて `deno test` で行う。
- prettier は `modules/` を対象にしない。
- `src/`・`scripts/`・`app/`・`theme/`・`test/` のツールは変えない。

### 依存のバージョン

- root の `deno.json` の `nodeModulesDir` は `"auto"` とし、`deno install` が root と member の `imports` から `node_modules` を作る ([ADR-0017](./0017-unify-runtime-and-tooling-on-deno.md))。
- member の npm 依存 (`react`・`remotion`・`@remotion/media` 等) は root の `deno.json` の `imports` と同じ exact 版で書く。理由: 同じパッケージの版が root と member で分かれると、`node_modules` に 2 つの版が入り、React のように 1 つの実体を前提とするパッケージが壊れる。同期は Dependabot の group (react) と `deno task upgrade` (Remotion) が行う。
- `deno.lock` をコミットする。理由: npm と jsr の依存の解決結果を固定し、CI の `deno install --frozen` で宣言との食い違いを検出するため。
- jsr 依存 (`@std/*`) は範囲内で浮き、`deno.lock` が固定する。更新は `deno outdated -r --update` で行う。
- 依存の更新は Dependabot の `deno` の entry が行い、root と member の `deno.json` を見る。react 系は group (react) で 1 つの PR にまとめる。Remotion は Dependabot の対象外で、`deno task upgrade` が root と member の pin を揃える。

## Consequences

### 利点

- `modules/` の純粋なロジックの型検査・lint・整形・テストを、所有者が普段使う Deno のツールで回せる。
- 境界の検査・コンポーネントのテスト・Remotion の bundle と render は、これまでと同じ Node のツールで動き続ける。

### 代償

- 同じ `modules/` に対して 2 つのツールチェーン (Deno の型検査・lint と、Node の `tsc`・ESLint) が走る。
- テストの書き方が 2 通りになる。`modules/` の `.test.ts` は `@std/testing/bdd`、`.test.tsx` とそれ以外のディレクトリのテストは vitest で書く。
- 整形のツールがディレクトリで分かれる。`modules/` は `deno fmt`、それ以外は prettier である。
- `src/` 等から `modules/` へ移すテストは、`.test.ts` であれば `@std/testing/bdd` と `@std/expect` に書き換える必要がある。
- module を足すときは、その module の `deno.json` (`name`・`exports`・`imports`・`tasks` の 4 つ) も書く必要がある。

### 禁止事項

- `modules/**/*.test.ts` を vitest で書くこと、または CSS Modules を読むテストを `.test.ts` として置くこと。
- member の npm 依存を root の `deno.json` と違う版で書くこと。
- member を相対パスで import すること、または member の `index.ts` 以外のファイルを import すること。
- member の 4 つの task (`check`・`lint`・`fmt:check`・`test`) を省くこと。
- member の `deno.json` に `nodeModulesDir` を書くこと。
- `modules/` に対する ESLint の境界の規則を、Deno の lint で置き換えたとして外すこと。
- `modules/` を prettier で整形すること。

## Assumptions

| 前提                                                                  | 状態   | 確認方法 / 結果                                                                                                                                           |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deno fmt` と prettier の整形結果の差は末尾カンマ程度に留まる         | 検証済 | 2026-10-01、`deno fmt --check modules/` で差分は 23 ファイル中 1 ファイル (末尾カンマ) だった                                                             |
| Deno が `nodeModulesDir: "manual"` で `node_modules` の依存を解決する | 検証済 | 2026-10-01、deno 2.9.6 で `deno check modules/` と `deno test` が通った                                                                                   |
| Remotion のバンドラが alias で `@motovlog/<name>` を解決する          | 検証済 | 2026-10-07、deno 2.9.7 と Remotion 4.0.529 で、alias を外すと `Can't resolve '@motovlog/annotation'` で失敗し、付けると `compositions`・`render` が通った |
| Deno が CSS Modules の実行時 import に対応しない                      | 検証済 | 2026-10-01、deno 2.9.6 で `Importing these types of modules is currently not supported.` を確認した                                                       |

## References

- 2026-10-01 の所有者の計画承認: `modules/` の型検査・lint・整形・純粋なロジックのテストを Deno で行い、Remotion の bundle と render、リポジトリ全体の `tsc`、ESLint の境界の規則、CSS Modules を読むテスト、`src/` 等は Node に残す。`deno.json` の npm パッケージのバージョンは `package.json` に揃える。
- 2026-10-01 の deno 2.9.6 での実測 (Context に記載した結果)。
- 2026-10-03 の所有者の計画承認: `modules/<name>/` を Deno の workspace の member とし、module ごとに `deno.json` (name・exports・imports・tasks) を持たせる。member 間の import は相対パスのまま、`nodeModulesDir` と `include` は root に残す。
- 2026-10-03 の deno 2.9.6 での実測 (Context に記載した workspace の結果)。`deno task --help` の `--members  Run the task in all workspace members, but not in the workspace root`。
- 2026-10-06 の所有者の承認: member の npm 依存は exact で `package.json` と揃え、Dependabot の multi-ecosystem group で同時に上げる。`deno.lock` は使わない。
- 2026-10-07 の所有者の承認 ([ADR-0017](./0017-unify-runtime-and-tooling-on-deno.md) の 3 段階目): `package.json` を外し、member の npm 依存は root の `deno.json` と揃える。`deno.lock` をコミットする。member は `@motovlog/<name>` の名前で import し、Remotion のバンドラには `remotion.config.ts` の alias で解決させる。
- Remotion のドキュメント「Webpack and Rspack」(https://www.remotion.dev/docs/bundlers): `Config.overrideBundlerConfig()` は "With either selected bundler. Runs first."、`Config.overrideWebpackConfig()` は "Only when Webpack is selected."。
