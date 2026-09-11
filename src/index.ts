// lib の root export (package.json の exports の "." に対応、ADR-0012)。
// registerRoot() はここでは呼ばない。入口 (registerRoot) は利用側の
// app/index.ts が持ち、そこで configure() を呼んでから RemotionRoot を登録する。
export { configure, getSetup } from "./setup.ts";
export type { Setup, Theme } from "./setup.ts";
export { RemotionRoot } from "./Root.tsx";
export { calculateMetadata, Motovlog } from "./compositions/Motovlog.tsx";
export type { MotovlogProps } from "./compositions/Motovlog.tsx";
export * from "./effects/index.ts";
export * from "./components/index.tsx";
export * from "./compositions/index.ts";
export * from "./theme/index.ts";
