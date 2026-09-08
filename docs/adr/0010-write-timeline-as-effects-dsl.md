---
status: accepted
date: 2026-09-08T07:57:51Z
supersedes: [4]
refs: [2, 3, 8]
tags: [remotion, timeline, effects]
---

# ADR-0010: timeline を演出 (effects) の DSL で書き、演出の層は動画の型を知らないようにする

## Context

- [ADR-0004](./0004-timeline-schema-design.md) で、timeline を秒単位の TypeScript オブジェクトと zod schema で表現し、track (clips・overlays・bgm・lines・characterSegments・ending) の列として持つと決めた。
- その構成では、章タイトル・写真・ED といった動画の要素を足すたびに schema と配線コンポーネントの両方が増え、フェード等の演出が要素ごとに重複して書かれた。
- 2026-09-08 の main (2a0ef6d) で timeline の機構を削除した。削除した機構は src/timeline・Motovlog・配線コンポーネント・サンプル timeline を含む。この時点で残っていたのは src/components の純粋コンポーネント (固定の props を受けて描くだけ) と src/theme だけであり、Root は Composition を持っていなかった。
- 設計議論 (2026-09-08) で、配線の層のあり方を整理した。配線の層は動画の型 (章・写真・ED 等) を知らない。演出の術 (フェード・カットイン等) だけを管理する。
- 続く設計議論 (2026-09-08) で、item の 1 本の配列に z 順 (重なり順) と時間の連結を両方担わせると読み違えることが分かった。AviUtl 等の映像編集ソフトは z 順を担う layer (トラック) と、layer 内の時間軸を分けて扱う。
- Remotion (4.0.521) の事実:
  - Composition の defaultProps と calculateMetadata が返す props は JSON 直列化可能でなければならず、関数やクラスは render 時に失われる (Date・Map・Set・staticFile() は例外)。
  - JSON 直列化できない資産は、component 内で delayRender() を呼び、読み込み後に continueRender() する形が文書化されている。この読み込みは render worker ごとに実行される。
  - Sequence は from と durationInFrames で子の mount 範囲を決め、内側の useCurrentFrame() は from 分だけ付け替えられて 0 起点になる。
  - TransitionSeries は自身の Sequence・Transition・Overlay 以外を子に取れない。
  - 新規コードの動画には @remotion/media の Video が推奨され、trimBefore・trimAfter はフレーム単位で指定する。

## Decision Drivers

1. 動画の型 (章・写真・ED 等) が増減しても、演出の層に手を入れない。
2. 動画 1 本の内容を projects/<slug>/timeline.ts の 1 ファイルで読める。
3. 見た目と秒数の正本は theme ([ADR-0008](./0008-fix-look-in-theme-not-timeline.md)) のままにする。
4. Remotion の props 直列化の制約を破らない。

## Considered Options

1. timeline.ts を演出関数 (timeline・fade・cut) の呼び出しで書き、演出の層は React 要素と秒だけを受ける — 採用。動画の型は timeline.ts 側 (コンポーネントの要素ファクトリ) にだけ現れ、演出の層は要素の中身を知らずに Sequence と opacity に変換する。
2. [ADR-0004](./0004-timeline-schema-design.md) の track 型 schema に要素を足し続ける — 却下。要素が増えるたび schema と配線が増え、演出が要素ごとに重複する。
3. 演出の描写を Remotion の TransitionSeries に任せる — 却下。TransitionSeries は自身の Sequence・Transition・Overlay しか子に取れず、任意の要素を任意の時刻に重ねる構成に合わない。
4. 動画ごとに Motovlog 相当の React コンポーネントを書く — 却下。Sequence と opacity の繰り返しを動画ごとに写すことになり、theme の秒数を参照する場所が散る。
5. item の 1 本の配列 (配列順で z 順と clip の連結を兼ねる) — 却下。z 順と時間の 2 つの規則が 1 本の配列に混ざり、後続 clip が前に書いた overlay を覆う。
6. 走行映像を effects の clip として持つ — 却下。effects が動画の型 (走行映像) を 1 つ知ることになり、trimBefore の換算のような素材の都合が術の層に入る。

## Decision

- projects/<slug>/timeline.ts は src/effects の関数 (timeline・fade・cut) の呼び出しで書き、timeline() の戻り値を default export する。
- src/effects は React 要素 (ReactNode) と秒だけを受ける。src/components・src/compositions・projects を import しない (ESLint の no-restricted-imports で禁止する)。
- src/components は src/effects を import しない。
- 走行映像は src/components の Video (@remotion/media の Video、[ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md)) で描き、fade/cut で timeline に置く。effects は clip を持たない。
- src/components が使ってよい Remotion の API は AbsoluteFill・Img・useVideoConfig と @remotion/media の要素に限り、useCurrentFrame 等のフレーム API は使わない。
- timeline() は item の配列ではなく layer (item の配列) の配列を受ける。layer は z 順を表し、配列の後ろが上に重なる。
- layer 内の item は時間が重ならない。重なりを検出したら timeline() が throw する。
- layer 内の item の位置は、省略 (同じ layer の直前の item の終端に連結する。最初は 0 秒)・`after: n` (直前の item の終端から n 秒後)・`at: n` (絶対秒) のいずれかで指定する。`at` と `after` を同時に指定したら throw する。
- fade・cut は、上記の連結の規則 (省略・`after`・`at`) に従う。`at` は必須ではない。
- 時間は秒で書く。フレーム換算は終端基準の丸め (from = round(start × fps)、durationInFrames = max(1, round((start + duration) × fps) − from)) で行う。
- timeline() の戻り値は React 要素を含むため、Composition の props に載せない。props は slug だけとし、calculateMetadata と component の双方が timeline.ts を動的 import する。component 側は delayRender() と continueRender() で読み込みを待つ。
- project の選択は環境変数 REMOTION_PROJECT で行い、未設定ならサンプル project を読む ([ADR-0004](./0004-timeline-schema-design.md) から引き継ぐ)。
- zod による timeline schema は持たない。形は TypeScript の型で担保し、読み込み時は default export の形 (fps が number、layers が配列) だけを検査する。
- timeline.ts が渡す src (走行映像・写真・立ち絵) は staticFile() 済みの URL とする。
- layer 内の item は時間順に並べる。順序が前後していれば timeline() が throw する。
- 空の layer は置かない。あれば timeline() が throw する。
- layer の最初の item の after は 0 秒からの相対とする。
- 字幕・音声・ED・立ち絵・BGM・サムネ用フレームの演出は、この ADR では決めない。

## Consequences

### 利点

- 新しい演出 (シーン切り替え等) は src/effects に関数を 1 つ足すだけで増やせ、動画の型には触れない。
- timeline.ts が動画 1 本の内容と演出を時系列で一望できる。
- 演出の計算 (フレーム換算・opacity) が React に依存しない純粋関数になり、単体テストできる。

### 代償

- render worker ごとに timeline.ts の動的 import が走る。
- Studio の props パネルから timeline の内容を編集できない (props は slug だけ)。
- zod を外したため、timeline.ts の誤りは型検査と読み込み時の最小限の検査でしか捕まえられない。
- fade の in/out は不透明度だけに効き、音量には効かない。走行音のフェードは別に決める。

### 禁止事項

- src/effects が src/components・src/compositions・projects を import すること。
- src/components が src/effects を import すること。
- src/components が useCurrentFrame 等のフレーム API を使うこと。
- timeline() の戻り値や React 要素を Composition の props や defaultProps に載せること。
- timeline.ts に見た目のトークンや演出の秒数の正本を置くこと (theme を参照する)。

## Assumptions

| 前提                                                                      | 状態   | 確認方法 / 結果                                            |
| ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| render worker ごとの timeline.ts の動的 import が render 時間に影響しない | 未検証 | 実動画 1 本を render し、worker の起動時間を比べる         |
| 字幕・音声・ED・立ち絵・サムネ用フレームをこの DSL の演出関数で表現できる | 未検証 | それぞれの演出を src/effects に足して timeline.ts に書く   |
| layer と after で複数クリップと overlay を重ならずに書ける                | 未検証 | 複数クリップと overlay を持つ project を作って render する |

## References

- ユーザからの依頼 (2026-09-08): timeline.ts を timeline・fade・cut の呼び出しで書けるようにし、演出の層を src/effects に置きたい。
- 設計議論 (2026-09-08): 配線の層は動画の型を知らず演出の術を管理する層にする。tracks・timeline という名前は演出の層の名前としてずれる。
- 設計議論 (2026-09-08): 第一階層を layer にし、layer 内は after で相対・at で絶対の位置を指定する。
- 設計議論 (2026-09-08): clip は術でなく素材の型なので effects から外し、走行映像は src/components の要素にする。
- [ADR-0002](./0002-project-directory-layout.md)
- [ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md)
- [ADR-0004](./0004-timeline-schema-design.md)
- [ADR-0008](./0008-fix-look-in-theme-not-timeline.md)
- https://www.remotion.dev/docs/composition
- https://www.remotion.dev/docs/calculate-metadata
- https://www.remotion.dev/docs/data-fetching
- https://www.remotion.dev/docs/sequence
- https://www.remotion.dev/docs/media/video
- https://www.remotion.dev/docs/transitions/transitionseries
