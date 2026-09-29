// TypeScript 5.9 には Temporal の型が無い (6.0 で esnext.temporal lib に入る)。
// temporal-polyfill/global (app/index.ts) が実行時にグローバルへ入れる Temporal
// の型をここで参照する (motovlog の ADR-0007)。lib の同等のファイルは
// node_modules 内にあり tsc の既定の include に入らないため、利用側で持つ。
/// <reference types="temporal-polyfill/types/global" />
