---
status: accepted
date: 2026-10-10T00:00:00Z
supersedes: [16, 17]
refs: [12, 15]
tags: [tooling, runtime, node, remotion, modules]
---

# ADR-0018: Remotion の実行と開発ツールを Node と npm に戻す

## Context

[ADR-0016](./0016-use-deno-tooling-for-modules.md) と [ADR-0017](./0017-unify-runtime-and-tooling-on-deno.md) により、Remotion CLI の実行・`scripts/` の実行・テスト・型検査・lint・整形は Deno で行い、依存は root の `deno.json` に書いている。`modules/<name>/` は Deno の workspace の member で、`@motovlog/<name>` の名前で import されている。

Deno は 2026-10-09 に、チームが Cloudflare に加わることを公表した。Deno の runtime は今後 1 年間、バグ修正とセキュリティ修正を含む月次のリリースが続き、その後は Deno チームによる開発が終わる。

Remotion の CLI のドキュメントには「Deno is not supported by Remotion.」と書かれている。Remotion の Bun のドキュメントには「we mostly support it」と書かれている。

## Decision Drivers

1. 開発の終了が告知された実行環境の上に、ツールチェーンと依存の宣言を置かないこと
2. Remotion が公式に対応する実行環境で、bundle・render・Studio を動かすこと
3. `modules/` の構成と、層と module の境界の検査を失わないこと

## Considered Options

1. Node と npm に戻し、`modules/` の構成と module ごとの CI は保つ — 採用。Remotion が公式に対応する実行環境に戻り、[ADR-0016](./0016-use-deno-tooling-for-modules.md) より前に動いていたツールチェーン (`tsx`・vitest・`tsc`・ESLint・prettier) をそのまま使える。
2. Deno を使い続ける — 却下。開発の終了が告知されており、Remotion も Deno に対応していない。
3. Bun に移す — 今は採用しない。Remotion の対応は「mostly」に留まり、得られる差は `scripts/` の実行に要る `tsx` を外せることだけである。実行環境の呼び出しは npm の `scripts` に閉じているため、後から切り替えられる。

## Decision

- Remotion CLI (`compositions`・`bundle`・`render`・`studio`) と `scripts/` を Node で実行する。`scripts/` の TypeScript は `tsx` で実行する。
- 依存は `package.json` に書き、`package-lock.json` をコミットする。CI は `npm ci` で依存を入れる。
- 型検査は `tsc`、lint は ESLint、整形は prettier、テストは vitest で行う。
- 利用側は [ADR-0012](./0012-split-template-library-from-consumer.md) のとおり `npm install github:ansanloms/motovlog-template` で取り込む。
- `modules/<name>/` の構成は [ADR-0015](./0015-split-components-into-modules.md) のとおり保つ。module 間と `src/` からの import は、拡張子付きの相対パスで書く。
- module の境界は、ESLint の相対パスに基づく規則で検査する。
- CI は lint・test・build の job に加え、`modules/` 直下のディレクトリを列挙した matrix の job で、module ごとに ESLint と vitest を実行する。
- `deno.json`・`deno.lock`・Deno の workspace・`@motovlog/<name>` の名前・CSS Modules のテスト用スタブは置かない。

## Consequences

### 利点

- Remotion が公式に対応する実行環境で動く。
- ツールチェーンが、開発の継続する Node と npm の上に乗る。
- `modules/` の構成・module ごとの CI・境界の検査を保てる。

### 代償

- `deno fmt`・`deno lint`・`@std/testing`・`@std/expect` を使えなくなる。
- `scripts/` の実行に `tsx` が要る。

### 禁止事項

- `deno.json`・`deno.lock` を置き、Deno で実行や検査をすること。
- `modules/<name>/` を名前付きの package (`@motovlog/<name>` 等) として import すること。
- module ごとに `package.json` を置き、npm workspaces に分けること ([ADR-0015](./0015-split-components-into-modules.md))。

## Assumptions

| 前提                                                                      | 状態   | 確認方法 / 結果                                                     |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Bun に切り替えるときは、npm の `scripts` の書き換えで実行環境を替えられる | 未検証 | 切り替えを検討するときに、`scripts` と CI を Bun で実行して確認する |

## References

- 2026-10-10 の所有者の決定: 開発の終了が告知された実行環境の上には作らないとして、`modules/` の構成を保ったまま実行と開発ツールを Node と npm に戻す。Bun は今は採用しない。
- Deno is joining Cloudflare (2026-10-09): https://deno.com/blog/cloudflare 。Deno の runtime は 1 年間、バグ修正とセキュリティ修正の月次リリースを続け、その後開発を終えると書かれている。
- Remotion の CLI のドキュメント: https://www.remotion.dev/docs/cli/ 。「Deno is not supported by Remotion.」と書かれている。
- Remotion の Bun のドキュメント: https://www.remotion.dev/docs/bun 。「we mostly support it (from v1.0.3)」と書かれている。
