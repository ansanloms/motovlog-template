// WAV (RIFF/WAVE) バッファの実尺を求める (ADR-0006)。
//
// mora の長さの合計 (query 由来) と wav の実尺にはずれがあるため、
// lines[].duration には wav の実尺を書き戻す。chunk を順に辿るので、
// fmt と data の間に他の chunk (LIST 等) が挟まっていても動く。

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

      byteRate = buffer.readUInt32LE(dataStart + 8);

      if (byteRate === 0) {
        throw new Error("fmt チャンクの byteRate が 0 です");
      }
    } else if (chunkId === "data") {
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
