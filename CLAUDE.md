# CLAUDE.md (motovlog-template)

このリポジトリ固有の運用ルール。グローバル設定 (`~/.claude/CLAUDE.md` 及び `rules/` 配下) に追加・上書きする。

## 調査運用: Remotion ドキュメントの参照

グローバルの `research.md` ルールは、ライブラリ仕様の調査に `find-docs` skill (Context7) の使用を MUST とし、WebSearch/WebFetch を ctx7 の代替にすることを禁止している。

このリポジトリには `.claude/skills/remotion-*` (`remotion-docs`・`remotion-best-practices` 等) が同梱されている。`remotion-docs` の実体は Algolia 検索 + remotion.dev への直接 WebFetch であり、素のままではグローバルルールの禁止対象に当たる。

**このリポジトリでは、Remotion のライブラリ仕様の調査に限り、`find-docs` (Context7) より `remotion-docs` (または `remotion-best-practices` 経由) を優先して使う。** WebFetch 禁止の明示的な例外とする。

理由:
- `remotion-docs/SKILL.md` の `version` フィールドが、このリポジトリにインストールされている Remotion のバージョンに追従している。Context7 のスナップショットにはバージョン注記が付かないことがあり (2026-09-06 実測)、インストール済みバージョンとの対応がこちらの方が明確。
- remotion.dev を直接ソースとするため、Context7 経由の GitHub ミラーより反映の遅延が小さい可能性がある (未検証)。

適用範囲: このリポジトリでの Remotion ライブラリ仕様の調査のみ。他のライブラリの調査は `research.md` ルールに従い `find-docs` を使う。メインループ・subagent (`research-worker` 等) を問わず適用する。

グローバルルール側の一般原則化は ansanloms/dotfiles#79 で追跡中。
