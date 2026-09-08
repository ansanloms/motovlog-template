---
status: accepted
date: 2026-09-08T12:13:14Z
refs: [1, 6]
tags: [layout, remotion]
---

# ADR-0002: 動画 project の定義と素材を単一リポジトリの所定ディレクトリに置く

## Context

[ADR-0001](./0001-use-remotion-for-video-production.md) で動画作成に Remotion を採用し、動画の内容はコードまたはテキストデータとして版管理すると決めた。モトブログは同じ構成の動画を数多く作る用途で、動画 1 本の定義 (timeline) は数 KB のテキストである一方、素材 (ドラレコ映像の変換済み素材・音声) は GB 単位になる。

Remotion には次の制約がある。

- 配信できるのは public ディレクトリ配下の実体ファイルだけで、絶対パスや `file://` は非対応。シンボリックリンクで置いたファイルは配信されない (2026-09-01 の検証)。
- `remotion render --props=<file>` で JSON ファイルを入力にでき、`calculateMetadata` がその内容から尺と解像度を決められる。1 つのコードベースから複数の動画を作る公式のパターンはこの形で、動画間の差分はコードではなく入力データになる。
- 長尺の HEVC 原本は直接読めず、H.264 の変換済み素材へ変換した上で public 配下に置く必要がある (2026-09-02 の検証)。

素材は由来とライセンスが混在する。ドラレコ映像とセリフ音声は動画ごとに固有で自作。立ち絵は VOICEVOX のキャラクター (青山龍星) の第三者制作の素材で、リポジトリで再配布する前提にない。BGM や効果音は第三者の素材を使うことがあり、再配布の可否は素材ごとに異なる。自作の素材 (効果音・図版等) も今後増える見込みで、これは版管理したい。

## Decision Drivers

1. エンジン (コンポーネント・schema) の変更がすべての動画に伝播すること
2. timeline を git で diff でき、公開した動画の再現に必要なものをタグで固定できること
3. Remotion が素材を配信できる配置であること
4. 素材の git 管理を、サイズとライセンスに応じて種別ごとに分けられること
5. timeline は人が書き、音声生成などの結果と分けて扱えること
6. 共通素材と動画固有の素材をパスで見分けられること

## Considered Options

1. 単一リポジトリで、timeline を `projects/<slug>/timeline.ts`、動画固有の素材を `public/projects/<slug>/`、共通素材を `public/assets/<種別>/` に置き、共通素材のコミット可否はライセンスで決める — 採用。素材はすべて public 配下にあり Remotion が配信できる。timeline は環境変数で選んだ project を動的 import で読む。`public/assets/` は既定でコミットせず、再配布できる自作素材だけを `.gitignore` の否定パターンで明示するため、判断を忘れた素材が混入しない。
2. 単一リポジトリで、timeline を `src/data/<slug>.ts`、素材を `public/videos/<slug>/` に置く (issue での先行提案) — 却下。project の定義がエンジンのソースの中に混ざり、動画を増やすたびに Composition の登録かエントリの切り替えをコードに書くことになる。
3. 単一リポジトリで、timeline と素材を `projects/<slug>/` にまとめて置く — 却下。素材が public の外になり Remotion が配信できない。`--public-dir` を project ごとに切り替えると共通素材が届かなくなる。
4. 動画ごとに別リポジトリを作る — 却下。エンジンの更新が各動画に伝播せず、数 KB の timeline のためにリポジトリと依存の複製を抱える。
5. 素材をすべて git (LFS を含む) で管理する — 却下。GB 単位の変換済み素材と再配布制限のある BGM を含むため、リポジトリを公開・移行できなくなる。
6. 共通素材のコミット可否を種別単位で決める (`characters`・`se` はコミット、`bgm`・`fonts` はコミットしない) — 却下。同じ種別に自作と第三者の素材が混ざり、種別では判断できない。

## Decision

- エンジン (Composition・コンポーネント・schema) と動画 project を 1 つのリポジトリで管理する。動画ごとにリポジトリを作らない。
- 動画 1 本を 1 つの project とし、`<slug>` で識別する。`<slug>` は `YYYYMMDD-<name>` の形とし、日付 8 桁・ハイフン・ASCII 小文字の kebab-case で書く (例: `20260817-jododaira`)。
- timeline 定義は `projects/<slug>/timeline.ts` に置く。`timeline()` の戻り値を default export し、コミットする。エンジンは環境変数 `REMOTION_PROJECT` で選んだ project のこのファイルを動的 import で読む ([ADR-0006](./0006-write-timeline-as-effects-dsl.md))。
- 動画固有の素材 (変換済み素材・セリフ音声・口パクのタイミング等) は `public/projects/<slug>/` に置く。`public/projects/` はコミットしない。
- 動画をまたいで使う共通素材は `public/assets/<種別>/` に置く。種別は `bgm`・`se`・`characters/<name>`・`fonts` とする。`bgm` は T&M が全編走行音だけで通すと決めているため、当面は空のまま置く。
- `public/assets/` 配下は既定でコミットしない。`.gitignore` で `public/assets/` 配下を除外し、`.gitkeep` と、再配布できる自作素材のディレクトリまたはファイルだけを否定パターンで明示してコミットする (書式は `.gitignore` の注記に従う)。
- 第三者の素材は、種別を問わずコミットしない。コミットしない素材とドラレコの原本はリポジトリの外 (外部ストレージ) に保管する。`public/projects/<slug>/` に置くのは変換済み素材と生成物だけにする。
- timeline から素材を参照するパスは public ディレクトリ相対とする (`assets/bgm/<file>`、`projects/<slug>/<file>`)。
- 動画を公開したら、その時点のコミットにタグ `render/<slug>` を打つ。再現はタグを checkout し依存を復元して render する。

## Consequences

### 利点

- エンジンの修正が 1 か所で済み、すべての動画に効く。
- timeline がテキストで diff でき、公開時点をタグで固定できる。
- 素材のパスを見れば共通素材か動画固有かが分かる。何を版管理しているかは `.gitignore` の否定パターンに現れ、判断の記録になる。

### 代償

- 動画 1 本の構成要素が `projects/<slug>/` と `public/projects/<slug>/` の 2 か所に分かれる。
- コミットしない素材 (第三者の素材・変換済み素材・原本) は外部ストレージでの保管と復元手順が要り、タグだけでは再現できない。
- 自作素材をコミットするたびに `.gitignore` に否定パターンを足す手間が要る。
- timeline.ts は評価が要るため、Remotion 以外のツールから読むには TypeScript を実行するランタイムが要る。

### 禁止事項

- 素材を public ディレクトリの外に置いて timeline から参照すること。
- シンボリックリンクで素材を public 配下に見せること。
- 動画固有の素材を `public/assets/` に置くこと、および共通素材を `public/projects/<slug>/` に置くこと。
- `public/projects/` をコミットすること。
- 再配布できない第三者の素材を、`public/assets/` のどの種別であってもコミットすること。
- `.gitignore` の否定パターン無しに `public/assets/` 配下の素材をコミットすること。

## Assumptions

| 前提                                                                                      | 状態   | 確認方法 / 結果                                                           |
| ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `REMOTION_PROJECT` で選んだ project を Studio と render の両方で読める                    | 検証済 | `npx remotion compositions` で確認 (2026-09-07)                           |
| `public/projects/` に GB 単位の変換済み素材を置いても render の準備時間が実用範囲に収まる | 未検証 | 実際の動画 1 本分の変換済み素材を置いて render の開始までの時間を計測する |
| コミットしない素材の原本が外部ストレージに保管され続ける                                  | 未検証 | 公開した動画をタグから再現する際に、素材の復元手順が通るかを確認する      |

## References

- https://www.remotion.dev/docs/miscellaneous/absolute-paths : 絶対パスが使えない理由と public ディレクトリの位置づけ。
- https://www.remotion.dev/docs/terminology/public-dir : public ディレクトリの定義。
- https://www.remotion.dev/docs/env-variables : `.env` の自動読み込みと `REMOTION_` 接頭辞。
- https://www.remotion.dev/docs/calculate-metadata : props から尺や解像度を算出する仕組み。
- https://www.remotion.dev/docs/dataset-render : 1 つのコードベースから複数の動画を作るパターン。
- 設計整理 (2026-09-08): 現在の設計を 1 から記述し直した
