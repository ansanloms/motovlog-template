import React from "react";

/**
 * `fade(..., { audio: true })` の item が、in/out の曲線から求めた音量の
 * 率 (0〜1) を下の要素に配る context。Stage (effects) が Provider を置き、
 * 要素 (components) が読んで自分の `volume` に掛ける。既定 1 (掛けない)。
 */
export const FadeGainContext = React.createContext<number>(1);

/** FadeGainContext を読む。Provider の外では既定値 1 になる。 */
export const useFadeGain = (): number => React.useContext(FadeGainContext);
