---
status: accepted
date: 2026-09-07T02:26:35Z
refs: [2]
tags: [remotion, timeline, schema]
---

# ADR-0004: timeline 定義を秒単位の TypeScript と zod schema で表現する

## Context

[ADR-0002](./0002-project-directory-layout.md) で、動画 1 本の定義 (timeline) を `projects/<slug>/` に置き、`calculateMetadata` で schema の検証と尺の算出をすると決めた。timeline の中身の形式はまだ決めていない。

Remotion には次の事実がある。

- `calculateMetadata` に渡る props は、`--props` などの input props が `defaultProps` を上書きした結果になる。返り値で `durationInFrames`・`fps`・`width`・`height` と、変換後の props を差し替えられる。
- `<Composition>` の `schema` に zod の object schema を渡すと、props の検証と Studio の編集 UI に使われる。
- `<Sequence>` の `from` と `durationInFrames` はフレーム単位で、秒では指定できない。
- CLI は `.env` を読み、`REMOTION_` で始まる環境変数だけをバンドルの `process.env` に渡す。`calculateMetadata` は非同期でよく、ディレクトリ部分をソース上のリテラルで書いた `import()` なら project ごとのモジュールを実行時に選んで読める (2026-09-07 の実機確認)。

当初は timeline を JSON で書き `--props` で渡す形にしたが、運用を始めると 3 つの問題が出た。JSON にはコメントが書けない。`lines[].start` を前のクリップの尺から計算できず手計算になる。`--props` は JSON しか受けず、`defaultProps` と浅くマージされるため省略したコンテナがサンプルの値を継承する (2026-09-07)。

既存のテンプレート実装 (未マージのブランチ) は、zod の `timelineSchema` と、`meta`・`clips`・`overlays`・`bgm`・`lines`・`subtitleBands`・`characterSegments`・`ending`・`style` の各トラックを持つ。時間は秒単位で、フレーム換算は終端基準で丸めるヘルパーに統一している。この実装のレビューでは、clips を絶対時刻で書く形にしていた間、クロスフェードの幾何 (重なりの長さと前後のクリップの尺の整合) に関する指摘が繰り返し出て収束せず、clips を順序リストにして位置を導出する形へ設計変更した経緯がある。

移行対象の既存動画 (約 6 分・1920×1080・30fps) は、映像クリップ 8・BGM 2 区間・セリフ 50・字幕 52・立ち絵 28 区間・字幕帯 6・クロスフェード 5・暗転 1 の要素を持つ。

## Decision Drivers

1. 台本から書き起こした値を人が読み書きでき、fps を変えても値が変わらないこと
2. 幾何的に矛盾する指定 (重なりの長さが前後のクリップの尺を超える等) を構造的に書けないこと
3. JSON 入力の検証と既定値の補完が 1 か所で行われ、コンポーネントが不正な値を受け取らないこと
4. 秒からフレームへの変換で区間の隙間や重複が生じないこと
5. 既存動画の要素を一通り表現でき、AviUtl のプロジェクトから機械的に移せること
6. timeline にコメントと式 (前のクリップの尺からの計算等) が書けること
7. 互換性を切る変更を後から安全に扱えること

## Considered Options

1. 時間は秒単位、clips は順序リストで位置を導出し、他のトラックは絶対時刻で置く。timeline は TypeScript で書き、zod schema を契約とし、`version` を持たせる — 採用。人が書く値は秒で、fps に依存しない。コメントと式が書ける。clips の重なりは `crossfadeIn` の上限を schema が検証するため矛盾を書けない。セリフや差し込みは映像と独立に絶対時刻で置ける。
2. 時間をフレーム単位で書く — 却下。fps を変えると全部の値が変わる。台本の秒数から人が換算することになる。
3. clips も絶対時刻 (`start`) で書く — 却下。重なりの長さと前後のクリップの尺が矛盾する指定を書けてしまい、テンプレート実装のレビューで指摘が収束しなかった。
4. すべてのトラックを順序リストにする — 却下。セリフ・差し込み・字幕帯は映像のクリップ境界と無関係に置きたい。AviUtl のプロジェクトは絶対時刻で持っており、移行にも絶対時刻が素直。
5. zod schema を持たず TypeScript の型だけにする — 却下。入力の検証と既定値の補完ができず、省略した項目が `undefined` のまま計算に渡る。Studio の編集 UI にも使えない。
6. timeline を JSON で書き、`--props` でファイルを渡す (当初の採用) — 却下 (2026-09-07)。コメントが書けず、`start` を式で書けない。`--props` は JSON しか受けず、`defaultProps` と浅くマージされる。
7. JSONC や YAML で書く — 却下。コメントは書けるが式は書けず、Remotion に渡す前の変換工程が要る。
8. すべての project の timeline を静的に import して Composition を並べる — 却下。1 つの project の timeline が壊れると Studio ごと開けなくなる。

## Decision

- timeline は `projects/<slug>/timeline.ts` が `export default` する TypeScript のオブジェクト (zod schema の入力型) とし、zod の `timelineSchema` を契約にする。`<Composition>` の `schema` に渡し、`calculateMetadata` で parse して既定値の補完と検証をする。parse を通っていない props をコンポーネントに渡さない。
- 音声生成の結果 (`lines[].audio`・`lipsync`・`duration`) は timeline.ts に書かず、`projects/<slug>/voice.json` に line ごとに置く。読み込み時に timeline と合成し、生成の無い line は明確なエラーで拒否する ([ADR-0006](./0006-generate-voice-and-lipsync-from-voicevox-api.md))。
- project の選択は環境変数 `REMOTION_PROJECT` (slug) で行い、`.env` に書いてよい。`Root.tsx` の `calculateMetadata` が `projects/<slug>/timeline.ts` と `voice.json` を動的 import で読む。`--props` は使わない。未設定のときはサンプル project を読む。
- timeline は `version` (正の整数) を持つ。省略時は 1 とする。互換性を切る変更をするときは新しい ADR で決めて `version` を 1 つ上げ、エンジンは対応しない `version` を parse で拒否する。
- 時間はすべて秒 (数値) で書く。フレーム換算はコンポーネント側で `meta.fps` を使って行い、区間の丸めは終端基準 (開始と終了を個別に丸めない) に統一する。
- `meta` は `width`・`height` (偶数、既定 1920×1080) と `fps` (既定 30) を持つ。
- トラックは `clips` (メイン映像)・`overlays` (差し込みの画像・動画)・`bgm`・`lines` (セリフ音声と字幕テキスト)・`subtitleBands` (字幕の背景帯)・`characterSegments` (立ち絵の表示区間)・`ending` (暗転とクレジット)・`style` (字幕と帯の見た目) の 8 つとする。既定値付きの項目とコンテナは省略できる。
- `clips` は絶対位置を持たない順序リストとし、各クリップの開始位置を `gapBefore` と `crossfadeIn` から導出する (先頭は `gapBefore`、2 つ目以降は前クリップの終端 + `gapBefore` − `crossfadeIn`)。先頭の `crossfadeIn` は 0 とし、`gapBefore` と `crossfadeIn` を同時に指定せず、`crossfadeIn` は直前クリップの露出長 (尺 − そのクリップの `crossfadeIn`) 以下とする。
- `clips` 以外のトラックの要素は絶対時刻 (`start` と `duration`) で置く。
- 動画の尺は全トラックの区間終端の最大値とする。
- 素材の参照は public ディレクトリ相対のパスで書く ([ADR-0002](./0002-project-directory-layout.md))。
- フィールドの追加は optional か既定値付きで行い、既存の timeline.ts が `version` を変えずに parse を通るようにする。

## Consequences

### 利点

- timeline を台本の秒数のまま書け、fps の変更が値に波及しない。
- clips の重なりが構造的に矛盾せず、検証で弾ける。
- 省略した項目は parse が補完し、コンポーネントは完全な値だけを扱う。
- timeline にコメントと式が書け、`lines[].start` をクリップの尺から計算できる。
- `version` により、互換性を切ったときに古い timeline を判別して変換できる。

### 代償

- 時間の表現が 2 種類 (clips は順序と相対値、他は絶対時刻) になり、clips の途中に挿入すると後続の映像だけがずれてセリフや字幕はずれない。
- 秒からフレームへの丸めで、区間の長さがフレーム単位で最大 1 フレームずれる。
- schema の検証規則が増えるほど、timeline を手で書くときのエラーの読み解きが要る。
- project の切り替えが環境変数経由になり、Studio で複数の project を同時に見るには別プロセスが要る。
- timeline.ts は TypeScript として評価されるため、式の誤りは Studio の読み込み時に分かる。

### 禁止事項

- clips に絶対時刻の開始位置を持たせること。
- timeline にフレーム単位の値を書くこと。
- schema の parse を通さずに props をコンポーネントへ渡すこと。
- 既存の timeline.ts が parse を通らなくなるフィールド変更を、`version` を上げずに行うこと。
- `--props` で timeline を渡すこと。
- 音声生成の結果 (`audio`・`lipsync`・`duration`) を timeline.ts に手で書くこと。

## Assumptions

| 前提                                                                                     | 状態   | 確認方法 / 結果                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 既存動画の要素 (映像 8・セリフ 50・立ち絵 28 区間等) をこの schema で表現できる          | 未検証 | AviUtl プロジェクトからの移行で、表現できない要素が無いかを確認する                                                       |
| ディレクトリ部分をリテラルで書いた動的 import が Studio と render の両方で解決される     | 検証済 | `npx remotion compositions` で `REMOTION_PROJECT` の project の尺が返ることを確認 (2026-09-07)。Studio は実装時に確認する |
| Remotion Studio で timeline.ts を保存すると `calculateMetadata` が再実行されて反映される | 未検証 | 実装時に Studio で保存と反映を確認する                                                                                    |
| clips の順序リストが、実際の編集作業で絶対時刻より扱いやすい                             | 未検証 | 数本作った後に、クリップの挿入・削除でセリフとのずれをどう直したかを振り返る                                              |

## References

- [ADR-0002](./0002-project-directory-layout.md): timeline の置き場、素材パスの規約。
- issue での検討 (2026-09): timeline を zod で定義し秒単位で書くこと、clips を順序リストにして `gapBefore`・`crossfadeIn` から位置を導出すること、各トラックの検証規則。
- テンプレート実装のレビュー (2026-09): clips を絶対時刻で書いた版でクロスフェード幾何の指摘が収束せず、順序リストへ設計変更した経緯。
- 既存動画 (浄土平) の AviUtl プロジェクトの調査 (2026-09): 要素の種類と件数。
- ユーザとの検討 (2026-09-06): `version` を持たせる判断。
- ユーザとの検討 (2026-09-07、書き換え): JSON ではコメントが書けず `start` を式で書けないため TypeScript に変え、`--props` をやめて環境変数で project を選ぶ判断。ADR-0000 の例外条項で本文を書き換えた。
- https://www.remotion.dev/docs/env-variables : `.env` の自動読み込みと `REMOTION_` 接頭辞。
- https://www.remotion.dev/docs/webpack-dynamic-imports : 動的 import の制約。
- https://www.remotion.dev/docs/dynamic-metadata : `calculateMetadata` の入出力。
- https://www.remotion.dev/docs/props-resolution : input props と `defaultProps` の優先順。
- https://www.remotion.dev/docs/composition : `schema` prop と Studio の編集 UI。
- https://www.remotion.dev/docs/sequence : `<Sequence>` がフレーム単位であること。
