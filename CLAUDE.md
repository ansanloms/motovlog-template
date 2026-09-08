# CLAUDE.md (motovlog-template)

## skill の導入

`.claude/skills/` 配下の skill は apm (Agent Package Manager) で導入する。依存は `apm.yml` に書き、`apm install` で `.claude/skills/` へ配置する。`apm.yml`・`apm.lock.yaml`・`.claude/skills/` はコミットし、`apm_modules/` はコミットしない。

- skill の追加は `apm.yml` に依存を書いて `apm install` を実行する。ref を固定していない依存 (`ansanloms/skills` 配下) の更新は `apm update` で行う。`apm install` は `apm.lock.yaml` に固定された commit を再配置するだけで、更新はしない。`.claude/skills/` 配下を直接編集しない。
- `remotion-dev/skills` は commit SHA で固定する。固定先は、その commit の `skills/remotion-docs/SKILL.md` の `version` が、インストール済みの Remotion (`package.json` の `remotion`) と一致する commit にする。
- Remotion をバージョンアップしたら、`remotion-dev/skills` の履歴から対応する commit を探して `apm.yml` の SHA を更新し、`apm install` を実行する。`remotion upgrade` はこの skill を更新しない。理由: 更新判定が `.agents/skills/` を対象にしており、このリポジトリの配置先 `.claude/skills/` を見ないため。
- `npx skills` や `remotion skills` (npm の skills CLI) で skill を追加・更新しない。理由: apm の管理外で `.claude/skills/` を書き換え、`apm.lock.yaml` のハッシュと乖離して `apm install --frozen` が通らなくなる。同梱の `remotion-upgrade` skill は `@remotion/cli` が無い環境の代替手順として `npx skills update` を案内するが、この手順は使わない。
- Dependabot (`.github/dependabot.yml`) は `remotion` と `@remotion/*` を `ignore` で対象外にしている。理由: Remotion の更新には上記の `apm.yml` の SHA 更新と `apm install` が伴い、Dependabot はそれを行えないため。`ignore` は security update にも効くため、Remotion の脆弱性修正も Dependabot の PR は作られない。Remotion は `npm run upgrade` と apm の手順で手動更新する。

## Remotion ドキュメントの参照

Remotion のライブラリ仕様 (API・設定・CLI) を調べるときは、このリポジトリに同梱されている `.claude/skills/remotion-docs` (または `remotion-best-practices` 経由) を使う。`remotion-docs` は Algolia 検索と remotion.dev への直接アクセスでドキュメントを取得する。

適用範囲: このリポジトリでの Remotion ライブラリ仕様の調査のみ。

理由は次の通り。

- `remotion-docs/SKILL.md` の `version` フィールドが、このリポジトリにインストールされている Remotion のバージョンと一致している。`apm.yml` で `remotion-dev/skills` を対応する commit に固定しているため。汎用の裏取り手段にはバージョン注記が付かないことがあり (2026-09-06 実測)、インストール済みバージョンとの対応がこちらの方が明確。
- remotion.dev を直接ソースとするため、ミラー経由より反映の遅延が小さい可能性がある (未検証)。

## シェルスクリプト

`scripts/` 配下のシェルスクリプトは `shellcheck` を通し、指摘 0 件にしてからコミットする。
