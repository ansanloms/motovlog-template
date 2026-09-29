// figure() は立ち絵の DSL で、effects と components の両方を使うため
// src/compositions/figure.ts に置く (ADR-0011・ADR-0014)。この module は
// コンポーネントだけを出す。
export { Figure } from "../../src/components/Figure.tsx";
