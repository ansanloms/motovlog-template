#!/usr/bin/env node
// 使い方: npx motovlog-convert <slug> <入力ファイル>...
//
// package.json の bin (ADR-0012)。外部リポジトリの利用側は tsx を直接
// 呼べない (依存として持たない) ため、tsx の CLI を子プロセスとして起動し、
// このパッケージ内の scripts/convert-movie.ts を利用側の cwd のまま実行
// する薄いラッパー (共通処理は scripts/bin/run-tsx.mjs)。引数はそのまま
// 渡し、終了コードを伝播する。

import { runTsx } from "./run-tsx.mjs";

runTsx(new URL("../convert-movie.ts", import.meta.url));
