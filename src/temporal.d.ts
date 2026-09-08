// TypeScript 5.9 には Temporal の型が無い (6.0 で esnext.temporal lib に入る)。
// temporal-polyfill/global が実行時にグローバルへ入れる Temporal の型を
// ここで参照する (ADR-0007)。
/// <reference types="temporal-polyfill/types/global" />
