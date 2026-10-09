import { describe, expect, it } from "vitest";
import { checkSpeaker } from "./engine.ts";

const VOICEVOX_URL = "http://voicevox.example";

describe("checkSpeaker", () => {
  it("speaker が /speakers にあれば解決する", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify([{ styles: [{ id: 13 }] }]), {
        status: 200,
      })) as typeof fetch;

    await expect(
      checkSpeaker(fetchImpl, VOICEVOX_URL, 13),
    ).resolves.toBeUndefined();
  });

  it("speaker が /speakers に無ければ throw する", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify([{ styles: [{ id: 1 }] }]), {
        status: 200,
      })) as typeof fetch;

    await expect(checkSpeaker(fetchImpl, VOICEVOX_URL, 13)).rejects.toThrow(
      /speaker 13 が ENGINE の \/speakers にありません/,
    );
  });

  it("/speakers の応答が VOICEVOX ENGINE の形でなければ、別サーバの 200 を明確なエラーにする", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      })) as typeof fetch;

    await expect(checkSpeaker(fetchImpl, VOICEVOX_URL, 13)).rejects.toThrow(
      /\/speakers の応答が VOICEVOX ENGINE の形ではありません/,
    );
  });
});
