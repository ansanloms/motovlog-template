// 既定の話者と声質の型 (ADR-0010、ADR-0012)。値は利用側の theme/index.ts が
// 持ち、configure() で lib に渡る。ブラウザ側 (compositions) も voice の key を
// 作るために既定を知る必要があるため、型は theme に置く。ENGINE の URL は .env
// (VOICEVOX_URL) のまま、バンドルには入れない。

import type { Voice } from "../voice/cache.ts";

/**
 * 既定の話者と声質。全項目必須で、line() の voice はこの差分だけを書く
 * (src/voice/key.ts の resolveVoice())。speed・pitch・intonation・volume・
 * pause は倍率 (pitch のみオフセットで 0 が中立、他は 1 が中立)、
 * silenceBefore・silenceAfter は秒。
 */
export type Narrator = Voice;
