# CLAUDE.md (motovlog-template)

## Remotion ドキュメントの参照

Remotion のライブラリ仕様 (API・設定・CLI) を調べるときは、このリポジトリに同梱されている `.claude/skills/remotion-docs` (または `remotion-best-practices` 経由) を使う。`remotion-docs` は Algolia 検索と remotion.dev への直接アクセスでドキュメントを取得する。

適用範囲: このリポジトリでの Remotion ライブラリ仕様の調査のみ。

理由は次の通り。

- `remotion-docs/SKILL.md` の `version` フィールドが、このリポジトリにインストールされている Remotion のバージョンに追従している。汎用の裏取り手段にはバージョン注記が付かないことがあり (2026-09-06 実測)、インストール済みバージョンとの対応がこちらの方が明確。
- remotion.dev を直接ソースとするため、ミラー経由より反映の遅延が小さい可能性がある (未検証)。
