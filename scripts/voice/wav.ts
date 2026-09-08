// WAV (RIFF/WAVE) バッファの実尺を求める (ADR-0008)。
//
// mora の長さの合計 (query 由来) と wav の実尺にはずれがあるため、
// <key>.json の duration には wav の実尺を書く。chunk を順に辿るので、
// fmt と data の間に他の chunk (LIST 等) が挟まっていても動く。

/**
 * WAV バッファの実尺 (秒) を求める。data チャンクの宣言サイズがバッファの
 * 実バイト数を超えている (途中で切れた wav) 場合は throw する。
 */
export const wavDurationSeconds = (buffer: Buffer): number => {
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("WAVE 形式ではありません");
  }

  let offset = 12;
  let byteRate: number | undefined;
  let dataSize: number | undefined;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;

    if (chunkId === "fmt ") {
      // fmt チャンクのデータ部: AudioFormat(2) NumChannels(2) SampleRate(4)
      // ByteRate(4) ...。ByteRate はオフセット 8 から 4 バイト。ByteRate を
      // 読むには最低 16 バイト必要。
      if (chunkSize < 16) {
        throw new Error(
          `fmt チャンクが不正です (size ${chunkSize} バイトは 16 バイト未満です)`,
        );
      }

      // chunkSize (宣言サイズ) が実バイト数を超えていれば、ByteRate を読む
      // 前に打ち切る (RangeError より説明的なエラーにする)。
      if (dataStart + chunkSize > buffer.length) {
        throw new Error(
          `wav が途中で切れています (fmt チャンクの宣言サイズ ${chunkSize} バイトに対し、実サイズは ${buffer.length - dataStart} バイトしかありません)`,
        );
      }

      byteRate = buffer.readUInt32LE(dataStart + 8);

      if (byteRate === 0) {
        throw new Error("fmt チャンクの byteRate が 0 です");
      }
    } else if (chunkId === "data") {
      if (dataStart + chunkSize > buffer.length) {
        throw new Error(
          `data チャンクが途中で切れています (宣言サイズ ${chunkSize} バイトに対し、実サイズは ${buffer.length - dataStart} バイトしかありません)`,
        );
      }

      dataSize = chunkSize;
    }

    // チャンクは 2 バイト境界にパディングされる。
    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  if (byteRate === undefined || dataSize === undefined) {
    throw new Error("fmt または data チャンクが見つかりません");
  }

  return dataSize / byteRate;
};
