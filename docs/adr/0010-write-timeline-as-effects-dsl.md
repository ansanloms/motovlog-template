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

1. timeline.ts を演出関数 (video・clip・fade・cut) の呼び出しで書き、演出の層は React 要素と秒だけを受ける — 採用。動画の型は timeline.ts 側 (コンポーネントの要素ファクトリ) にだけ現れ、演出の層は要素の中身を知らずに Sequence と opacity に変換する。
2. [ADR-0004](./0004-timeline-schema-design.md) の track 型 schema に要素を足し続ける — 却下。要素が増えるたび schema と配線が増え、演出が要素ごとに重複する。
3. 演出の描写を Remotion の TransitionSeries に任せる — 却下。TransitionSeries は自身の Sequence・Transition・Overlay しか子に取れず、任意の要素を任意の時刻に重ねる構成に合わない。
4. 動画ごとに Motovlog 相当の React コンポーネントを書く — 却下。Sequence と opacity の繰り返しを動画ごとに写すことになり、theme の秒数を参照する場所が散る。

## Decision

- projects/<slug>/timeline.ts は src/effects の関数 (video・clip・fade・cut) の呼び出しで書き、video() の戻り値を default export する。
- src/effects は React 要素 (ReactNode) と秒だけを受ける。src/components・src/compositions・projects を import しない (ESLint の no-restricted-imports で禁止する)。
- src/components は src/effects を import しない。
- 時間は秒で書く。フレーム換算は終端基準の丸め (from = round(start × fps)、durationInFrames = max(1, round((start + duration) × fps) − from)) で行う。
- video() の戻り値は React 要素を含むため、Composition の props に載せない。props は slug だけとし、calculateMetadata と component の双方が timeline.ts を動的 import する。component 側は delayRender() と continueRender() で読み込みを待つ。
- project の選択は環境変数 REMOTION_PROJECT で行い、未設定ならサンプル project を読む ([ADR-0004](./0004-timeline-schema-design.md) から引き継ぐ)。
- zod による timeline schema は持たない。形は TypeScript の型で担保し、読み込み時は default export の形 (fps が number、items が配列) だけを検査する。
- 動画クリップは @remotion/media の Video で描く ([ADR-0003](./0003-convert-dashcam-footage-to-h264-proxy.md))。
- timeline.ts が渡す src (クリップ・写真・立ち絵) は staticFile() 済みの URL とする。
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

### 禁止事項

- src/effects が src/components・src/compositions・projects を import すること。
- src/components が src/effects を import すること。
- video() の戻り値や React 要素を Composition の props や defaultProps に載せること。
- timeline.ts に見た目のトークンや演出の秒数の正本を置くこと (theme を参照する)。

## Assumptions

| 前提                                                                      | 状態   | 確認方法 / 結果                                          |
| ------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| render worker ごとの timeline.ts の動的 import が render 時間に影響しない | 未検証 | 実動画 1 本を render し、worker の起動時間を比べる       |
| 字幕・音声・ED・立ち絵・サムネ用フレームをこの DSL の演出関数で表現できる | 未検証 | それぞれの演出を src/effects に足して timeline.ts に書く |
| clip の連結 (at 省略で直前の clip の終端) で複数クリップの動画を書ける    | 未検証 | 複数クリップの project を作って render する              |

## References

- ユーザからの依頼 (2026-09-08): timeline.ts を video・clip・fade・cut の呼び出しで書けるようにし、演出の層を src/effects に置きたい。
- 設計議論 (2026-09-08): 配線の層は動画の型を知らず演出の術を管理する層にする。tracks・timeline という名前は演出の層の名前としてずれる。
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
