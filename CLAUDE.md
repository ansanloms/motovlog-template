# CLAUDE.md (motovlog-template)

## lib との関係

このリポジトリは lib `motovlog` を使って動画を作る利用側で、`app/`・`theme/`・`projects/`・`characters/`・`public/` だけを持つ。lib は [ansanloms/motovlog](https://github.com/ansanloms/motovlog) にあり、`package.json` の `dependencies` で commit を固定して入れている (`github:ansanloms/motovlog#<commit>`)。

- lib の変更 (コンポーネント・演出・音声生成・変換・Studio 起動・Remotion のバージョンアップ) は `ansanloms/motovlog` で行う。`node_modules/motovlog` を直接編集しない。
- lib の更新を取り込むときは `package.json` の commit を差し替えて `npm install` し、`package-lock.json` と一緒にコミットする。commit を固定せずに依存に入れない。
- lib の仕様・設計上の決定 (ADR) は lib のリポジトリの `README.md` と `docs/adr/` を参照する。
- lib からの import は bare specifier (`motovlog`・`motovlog/effects`・`motovlog/components`・`motovlog/compositions`・`motovlog/theme`・`motovlog/modules/<name>`、`characters/` は `motovlog/compositions/character` だけ) を使う。範囲は `eslint.config.mjs` が検査する。
- Remotion 本体と `@remotion/*` は lib の `peerDependencies` と同じバージョンにそろえる。`@remotion/studio` が optional peer (`@remotion/whisper-webgpu`・`@remotion/video-matting`) を無条件に import するため、これらも同じバージョンで `devDependencies` に置く。

## 検証

`npm run lint` (ESLint・tsc・prettier) を通す。このリポジトリにテストは無い。timeline の読み込みは `npx remotion compositions app/index.ts` で `Motovlog` が列挙されることで確かめる。
