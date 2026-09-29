---
status: accepted
date: 2026-09-30T00:00:00Z
refs: [2, 11, 12, 14]
tags: [repository, package, boundary]
---

# ADR-0015: lib を motovlog リポジトリに置き、実際の project は利用側リポジトリに置く

## Context

[ADR-0012](./0012-split-template-library-from-consumer.md) は、lib (`src/`・`scripts/`) と利用側 (`app/`・`theme/`・`projects/`・`characters/`・`public/`) を同じリポジトリの中でディレクトリと `package.json` の `exports` によって分けた。外部のリポジトリからは GitHub 参照で lib を依存に入れる経路を用意したが、lib と利用側は同じリポジトリに同居していた。

同居していたリポジトリ `ansanloms/motovlog-template` には、lib と同梱のサンプル project (`projects/00000000-sample/`) に加えて、実際の走行から起こした project (`projects/20260813-jododaira/`) と、その project が参照するキャラクター定義があった。実際の project の立ち絵と走行映像はコミットしておらず、手元に素材が無い環境ではその project を render できない。

lib のテスト・lint・build と CI は、利用側の骨格 (`app/`・`theme/`・`projects/00000000-sample/`・`characters/sample.ts`・`test/setup.ts`・`public/assets/characters/sample/`) を使って動く。`docs/design/` は Claude Design のスナップショットを持ち、`theme/designSnapshot.test.ts` がサンプルの `theme/index.ts` とスナップショットの値を突き合わせる。

所有者は、Remotion のテンプレートとしての機能を完成と判断している (2026-09-30)。

## Decision Drivers

1. lib の変更と実際の動画の制作を、別々の履歴と別々のリリース単位で扱えること
2. lib のテスト・lint・build・CI が、外部の素材なしで lib のリポジトリだけで動き続けること
3. [ADR-0012](./0012-split-template-library-from-consumer.md) の境界 (5 入口・`configure()`・ESLint の検査) をそのまま使えること
4. lib の過去の決定と履歴を失わないこと

## Considered Options

1. lib を `ansanloms/motovlog` に移し、利用側の骨格はテスト用の fixture として lib に残し、実際の project は利用側リポジトリに置く — 採用。lib のリポジトリだけでテストと CI が完結し、[ADR-0012](./0012-split-template-library-from-consumer.md) の境界と検査をそのまま使える。
2. 1 つのリポジトリの中で `template/` と `works/` にディレクトリを分ける — 却下。[ADR-0012](./0012-split-template-library-from-consumer.md) で既に却下した案で、分離の宣言がディレクトリ名だけになる。lib の変更と動画の制作の履歴も分かれない。
3. `ansanloms/motovlog-template` の履歴を書き換えて実際の project を消し、force push して lib のリポジトリとして使い続ける — 却下。公開済みの履歴を書き換えるため、既存の clone と参照が壊れる。実際の project を利用側で続けるための置き場も別に要る。
4. 利用側の骨格も lib から消し、lib には `src/`・`scripts/` だけを置く — 却下。lib のテスト・build・CI が利用側の入口 (`app/index.ts`) とサンプル project を使うため、lib のリポジトリだけでは検証できなくなる。

## Decision

- lib (`src/`・`scripts/`・設定ファイル・`docs/`・`.claude/`・`.github/`) は `ansanloms/motovlog` に置く。`package.json` の `name` は `motovlog` とする。
- lib のリポジトリは `ansanloms/motovlog-template` の履歴を引き継ぐ。
- 利用側の骨格 (`app/`・`theme/`・`projects/00000000-sample/`・`characters/sample.ts`・`test/setup.ts`・`public/assets/characters/sample/`) は、テスト・CI・build の fixture として lib のリポジトリに残す。
- 実際の動画の project (`projects/<slug>/` のうちサンプル以外) と、そのキャラクター定義・素材は lib のリポジトリに置かない。`projects/20260813-jododaira/` とその project が参照するキャラクター定義は lib から削除し、利用側リポジトリに置く。
- `docs/design/` と `theme/designSnapshot.test.ts` は lib に残す。サンプルの `theme/index.ts` を Claude Design の参照実装として扱う。
- 利用側リポジトリは lib を `npm install github:ansanloms/motovlog#<commit>` で依存に入れ、commit を固定する。
- 利用側リポジトリは bare specifier `motovlog`・`motovlog/effects`・`motovlog/components`・`motovlog/compositions`・`motovlog/theme`・`motovlog/compositions/character` と、[ADR-0016](./0016-split-components-into-modules.md) の `motovlog/modules/<name>` で lib を import する。
- [ADR-0002](./0002-project-directory-layout.md) と [ADR-0012](./0012-split-template-library-from-consumer.md) は有効なまま残す。project の配置の規則と、lib と利用側の境界の規則は、利用側リポジトリと lib の fixture の両方に同じく適用する。

## Consequences

### 利点

- lib の変更と実際の動画の制作が別の履歴になり、利用側は lib の更新を commit の固定の差し替えとして受け取れる。
- lib のテストと CI が、コミットしていない素材を持つ project に左右されない。
- lib のリポジトリに第三者制作の立ち絵を参照する project が無くなる。

### 代償

- lib の変更を利用側で確かめるには、lib に commit してから利用側の依存の固定を更新する往復が要る。
- 利用側の骨格が lib と利用側リポジトリの 2 か所に存在する。lib の骨格は fixture であり、利用側リポジトリの骨格とは同期しない。
- `ansanloms/motovlog-template` の過去の ADR・コミット・issue にある名前 (`motovlog-template`) は、lib の名前 (`motovlog`) と食い違ったまま残る。

### 禁止事項

- lib のリポジトリに、サンプル以外の実際の project とそのキャラクター定義・素材を置くこと。
- lib のテスト・CI・build が、lib のリポジトリにコミットしていない素材を前提にすること。
- 利用側リポジトリが、commit を固定せずに lib を依存に入れること。

## Assumptions

| 前提                                                                                   | 状態   | 確認方法 / 結果                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub 参照で入れた lib を、利用側リポジトリの Remotion が追加設定なしでバンドルできる | 未検証 | 利用側リポジトリで `npm install github:ansanloms/motovlog#<commit>` し、Studio と render が通るかを確認する                                         |
| サンプルの骨格だけで lib のテスト・lint・build が足りる                                | 検証済 | 実際の project を削除した状態で `npm run lint`・`npm test`・`npm run build`・`npx remotion compositions app/index.ts` が通ることを確認 (2026-09-30) |

## References

- 2026-09-30 の計画承認: Remotion のテンプレートを完成とみなし、lib を `ansanloms/motovlog` に分け、実際の動画の project は利用側リポジトリで管理する。利用側の骨格は lib に fixture として残し、`docs/design/` と `theme/designSnapshot.test.ts` も lib に残す。
