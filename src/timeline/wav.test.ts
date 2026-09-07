import { describe, expect, it } from "vitest";
import { wavDurationSeconds } from "./wav";

// 24kHz・16bit・mono の WAV バッファを組み立てる。sampleCount 分の無音データを
// data チャンクに詰め、extraChunk があれば fmt と data の間に挿入する。
const buildWav = (sampleCount: number, extraChunk?: Buffer): Buffer => {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;

  const fmtChunkData = Buffer.alloc(16);
  fmtChunkData.writeUInt16LE(1, 0); // AudioFormat = PCM
  fmtChunkData.writeUInt16LE(channels, 2);
  fmtChunkData.writeUInt32LE(sampleRate, 4);
  fmtChunkData.writeUInt32LE(byteRate, 8);
  fmtChunkData.writeUInt16LE(blockAlign, 12);
  fmtChunkData.writeUInt16LE(bitsPerSample, 14);

  const fmtChunk = Buffer.concat([
    Buffer.from("fmt "),
    uint32le(fmtChunkData.length),
    fmtChunkData,
  ]);

  const dataChunk = Buffer.concat([
    Buffer.from("data"),
    uint32le(dataSize),
    Buffer.alloc(dataSize),
  ]);

  const middle = extraChunk
    ? Buffer.concat([fmtChunk, extraChunk, dataChunk])
    : Buffer.concat([fmtChunk, dataChunk]);

  const riffSize = 4 + middle.length; // "WAVE" + 以降のチャンク群
  return Buffer.concat([
    Buffer.from("RIFF"),
    uint32le(riffSize),
    Buffer.from("WAVE"),
    middle,
  ]);
};

const uint32le = (value: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
};

describe("wavDurationSeconds", () => {
  it("24kHz・16bit・mono・2400 サンプルは 0.1 秒になる", () => {
    const wav = buildWav(2400);

    expect(wavDurationSeconds(wav)).toBeCloseTo(0.1, 9);
  });

  it("fmt と data の間に LIST チャンクを挟んでも同じ結果になる", () => {
    const listChunkData = Buffer.from("INFOxxx"); // 奇数長でパディング境界も確認する
    const listChunk = Buffer.concat([
      Buffer.from("LIST"),
      uint32le(listChunkData.length),
      listChunkData,
      Buffer.alloc(listChunkData.length % 2), // 奇数長のパディング
    ]);

    const wav = buildWav(2400, listChunk);

    expect(wavDurationSeconds(wav)).toBeCloseTo(0.1, 9);
  });

  it("fmt チャンクが 16 バイト未満なら明確なエラーになる", () => {
    const truncatedFmtData = Buffer.alloc(8); // 16 バイト必要なところを 8 バイトにする
    const fmtChunk = Buffer.concat([
      Buffer.from("fmt "),
      uint32le(truncatedFmtData.length),
      truncatedFmtData,
    ]);
    const dataChunk = Buffer.concat([Buffer.from("data"), uint32le(0)]);
    const middle = Buffer.concat([fmtChunk, dataChunk]);
    const wav = Buffer.concat([
      Buffer.from("RIFF"),
      uint32le(4 + middle.length),
      Buffer.from("WAVE"),
      middle,
    ]);

    expect(() => wavDurationSeconds(wav)).toThrow(/fmt チャンクが不正です/);
  });

  it("byteRate が 0 なら明確なエラーになる", () => {
    const fmtChunkData = Buffer.alloc(16);
    fmtChunkData.writeUInt16LE(1, 0); // AudioFormat = PCM
    fmtChunkData.writeUInt16LE(1, 2); // channels
    fmtChunkData.writeUInt32LE(24000, 4); // sampleRate
    fmtChunkData.writeUInt32LE(0, 8); // byteRate = 0
    fmtChunkData.writeUInt16LE(2, 12); // blockAlign
    fmtChunkData.writeUInt16LE(16, 14); // bitsPerSample

    const fmtChunk = Buffer.concat([
      Buffer.from("fmt "),
      uint32le(fmtChunkData.length),
      fmtChunkData,
    ]);
    const dataChunk = Buffer.concat([Buffer.from("data"), uint32le(0)]);
    const middle = Buffer.concat([fmtChunk, dataChunk]);
    const wav = Buffer.concat([
      Buffer.from("RIFF"),
      uint32le(4 + middle.length),
      Buffer.from("WAVE"),
      middle,
    ]);

    expect(() => wavDurationSeconds(wav)).toThrow(/byteRate が 0 です/);
  });
});
