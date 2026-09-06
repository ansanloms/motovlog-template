---
status: accepted
date: 2026-09-06T12:25:08Z
refs: [1]
tags: [layout, remotion]
---

# ADR-0002: 動画 project の定義と素材を単一リポジトリの所定ディレクトリに置く

## Context

[ADR-0001](./0001-use-remotion-for-video-production.md) で動画作成に Remotion を採用し、動画の内容はコードまたはテキストデータとして版管理すると決めた。モトブログは同じ構成の動画を数多く作る用途で、動画 1 本の定義 (timeline) は数 KB のテキストである一方、素材 (ドラレコ映像のプロキシ・音声) は GB 単位になる。

Remotion には次の制約がある。

- 配信できるのは public ディレクトリ配下の実体ファイルだけで、絶対パスや `file://` は非対応。シンボリックリンクで置いたファイルは配信されない (2026-09-01 の検証)。
- `remotion render --props=<file>` で JSON ファイルを入力にでき、`calculateMetadata` がその内容から尺と解像度を決められる。1 つのコードベースから複数の動画を作る公式のパターンはこの形で、動画間の差分はコードではなく入力データになる。
- 長尺の HEVC 原本は直接読めず、H.264 のプロキシへ変換した上で public 配下に置く必要がある (2026-09-02 の検証)。

素材は由来とライセンスが混在する。ドラレコ映像とセリフ音声は動画ごとに固有で自作、立ち絵と効果音は動画をまたいで使う自作素材、BGM は動画をまたいで使う第三者の素材で再配布に制限が付くことが多い。

既存のテンプレート実装 (未マージのブランチ) は、素材を `public/sample/`、プロキシを `public/proxies/`、timeline を `src/data/sample.ts` にハードコードしている。

## Decision Drivers

1. エンジン (コンポーネント・schema) の変更がすべての動画に伝播すること
2. timeline を git で diff でき、公開した動画の再現に必要なものをタグで固定できること
3. Remotion が素材を配信できる配置であること
4. 素材の git 管理を、サイズとライセンスに応じて種別ごとに分けられること
5. timeline を Remotion 以外のプログラム (Deno 等のスクリプト) からも生成できること
6. 共通素材と動画固有の素材をパスで見分けられること

## Considered Options

1. 単一リポジトリで、timeline を `projects/<slug>/timeline.json`、動画固有の素材を `public/projects/<slug>/`、共通素材を `public/assets/<種別>/` に置く — 採用。素材はすべて public 配下にあり Remotion が配信できる。timeline は JSON なので `--props` で渡せ、他のプログラムからも生成できる。素材の git 管理をディレクトリ単位で分けられる。
2. 単一リポジトリで、timeline を `src/data/<slug>.ts`、素材を `public/videos/<slug>/` に置く (issue での先行提案) — 却下。timeline が TypeScript だと Remotion 以外から生成しにくく、動画を増やすたびに Composition の登録かエントリの切り替えをコードに書くことになる。
3. 単一リポジトリで、timeline と素材を `projects/<slug>/` にまとめて置く — 却下。素材が public の外になり Remotion が配信できない。`--public-dir` を project ごとに切り替えると共通素材が届かなくなる。
4. 動画ごとに別リポジトリを作る — 却下。エンジンの更新が各動画に伝播せず、数 KB の timeline のためにリポジトリと依存の複製を抱える。
5. 素材をすべて git (LFS を含む) で管理する — 却下。GB 単位のプロキシと再配布制限のある BGM を含むため、リポジトリを公開・移行できなくなる。

## Decision

- エンジン (Composition・コンポーネント・schema) と動画 project を 1 つのリポジトリで管理する。動画ごとにリポジトリを作らない。
- 動画 1 本を 1 つの project とし、`<slug>` で識別する。`<slug>` は `YYYYMMDD-<name>` の形とし、日付 8 桁・ハイフン・ASCII 小文字の kebab-case で書く (例: `20260817-jododaira`)。
- timeline 定義は `projects/<slug>/timeline.json` に置き、コミットする。エンジンは `remotion render --props=projects/<slug>/timeline.json` の形でこのファイルを受け取り、`calculateMetadata` で schema の検証と尺の算出をする。
- 動画固有の素材 (プロキシ・セリフ音声・口パクのタイミング等) は `public/projects/<slug>/` に置く。`public/projects/` はコミットしない。
- 動画をまたいで使う共通素材は `public/assets/<種別>/` に置く。種別は `bgm`・`se`・`characters/<name>`・`fonts` とする。
- `public/assets/` のコミット可否は種別単位で決める。`characters` と `se` はコミットし、`bgm` と `fonts` はコミットしない。
- コミットしない素材とドラレコの原本はリポジトリの外 (外部ストレージ) に保管する。`public/projects/<slug>/` に置くのは変換後のプロキシと生成物だけにする。
- timeline から素材を参照するパスは public ディレクトリ相対とする (`assets/bgm/<file>`、`projects/<slug>/<file>`)。
- 動画を公開したら、その時点のコミットにタグ `render/<slug>` を打つ。再現はタグを checkout し依存を復元して render する。

## Consequences

### 利点

- エンジンの修正が 1 か所で済み、すべての動画に効く。
- timeline がテキストで diff でき、公開時点をタグで固定できる。
- 素材のパスを見れば共通素材か動画固有かが分かり、gitignore の境界がディレクトリと一致する。
- timeline が JSON なので、音声合成やタイミング生成のスクリプトが Remotion と別のランタイムで書ける。

### 代償

- 動画 1 本の構成要素が `projects/<slug>/` と `public/projects/<slug>/` の 2 か所に分かれる。
- コミットしない素材 (BGM・フォント・プロキシ・原本) は外部ストレージでの保管と復元手順が要り、タグだけでは再現できない。
- timeline を JSON で書くため、TypeScript の型補完は効かない。誤りは schema の検証で検出する。

### 禁止事項

- 素材を public ディレクトリの外に置いて timeline から参照すること。
- シンボリックリンクで素材を public 配下に見せること。
- 動画固有の素材を `public/assets/` に置くこと、および共通素材を `public/projects/<slug>/` に置くこと。
- `public/projects/`・`public/assets/bgm/`・`public/assets/fonts/` をコミットすること。

## Assumptions

| 前提                                                                                  | 状態   | 確認方法 / 結果                                                                    |
| ------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Remotion Studio でも `--props` で project を切り替えてプレビューできる                | 未検証 | Studio の CLI オプションを確認し、切り替えられなければ Studio 用の入口を別途決める |
| `public/projects/` に GB 単位のプロキシを置いても render の準備時間が実用範囲に収まる | 未検証 | 実際の動画 1 本分のプロキシを置いて render の開始までの時間を計測する              |
| コミットしない素材の原本が外部ストレージに保管され続ける                              | 未検証 | 公開した動画をタグから再現する際に、素材の復元手順が通るかを確認する               |

## References

- [ADR-0001](./0001-use-remotion-for-video-production.md): Remotion 採用と、動画の内容をテキストデータとして版管理する決定。
- issue での先行提案 (2026-09-06): timeline をこのリポジトリに集約し、素材はリポジトリ外で管理して `public/videos/<slug>/` を作業場にする案と、Remotion 公式のデータ駆動パターンを根拠とする整理。
- 長尺・大容量ドラレコ動画の取り込み検証 (2026-09-01〜02): シンボリックリンクが配信されないこと、プロキシを public 配下の実体として置くこと、`--public-dir` の挙動の確認。
- ユーザとの検討 (2026-09-06): 単一リポジトリでの管理、公開時のタグ、slug の形式、共通素材の種別と BGM をコミットしない判断。
- https://www.remotion.dev/docs/miscellaneous/absolute-paths : 絶対パスが使えない理由と public ディレクトリの位置づけ。
- https://www.remotion.dev/docs/terminology/public-dir : public ディレクトリの定義。
- https://www.remotion.dev/docs/passing-props : `--props` で JSON ファイルを渡す方法。
- https://www.remotion.dev/docs/calculate-metadata : props から尺や解像度を算出する仕組み。
- https://www.remotion.dev/docs/dataset-render : 1 つのコードベースから複数の動画を作るパターン。
