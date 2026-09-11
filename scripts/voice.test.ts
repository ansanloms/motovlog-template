import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSetup } from "../src/setup.ts";
import {
  createRunQueue,
  noLinesWarning,
  readVoicevoxUrl,
  resolveSlugArg,
} from "./voice.ts";

describe("resolveSlugArg", () => {
  it("引数 (先頭の非フラグ) が env より優先される", () => {
    expect(
      resolveSlugArg(["20260101-foo"], { REMOTION_PROJECT: "20260101-bar" }),
    ).toBe("20260101-foo");
  });

  it("引数が無ければ env (REMOTION_PROJECT) を使う", () => {
    expect(resolveSlugArg([], { REMOTION_PROJECT: "20260101-bar" })).toBe(
      "20260101-bar",
    );
  });

  it("引数も env も無ければ configure() の defaultProject になる", () => {
    expect(resolveSlugArg([], {})).toBe(getSetup().defaultProject);
  });
});

describe("readVoicevoxUrl", () => {
  it("env の VOICEVOX_URL を返す", () => {
    expect(readVoicevoxUrl({ VOICEVOX_URL: "http://localhost:50021" })).toBe(
      "http://localhost:50021",
    );
  });

  it("未設定なら undefined を返す", () => {
    expect(readVoicevoxUrl({})).toBeUndefined();
  });
});

describe("noLinesWarning", () => {
  it("lineCount・silentCount ともに 0 件なら lib の入口の確認を促す警告を返す", () => {
    const warning = noLinesWarning(0, 0);

    expect(warning).toContain("発話 (line()) が 0 件でした");
    expect(warning).toContain("src/compositions/index.ts");
    expect(warning).toContain("motovlog-template/compositions");
  });

  it("lineCount が 1 件以上なら何も返さない (発話の無い project はエラーにしない)", () => {
    expect(noLinesWarning(1, 0)).toBeUndefined();
  });

  it("lineCount が 0 でも silentCount が 1 件以上なら何も返さない (声無しだけの project は正当)", () => {
    expect(noLinesWarning(0, 1)).toBeUndefined();
  });
});

describe("createRunQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("連続した要求はデバウンスされ、1 回の実行にまとまる", async () => {
    const run = vi.fn(async () => {});
    const onError = vi.fn();
    const request = createRunQueue(run, 200, onError);

    request();
    request();
    request();

    await vi.advanceTimersByTimeAsync(200);

    expect(run).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("実行中に来た要求は、終了後にもう 1 回だけ走る", async () => {
    let resolveFirst: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          if (!resolveFirst) {
            resolveFirst = resolve;
            return;
          }

          resolve();
        }),
    );
    const request = createRunQueue(run, 200, vi.fn());

    request();
    await vi.advanceTimersByTimeAsync(200);
    expect(run).toHaveBeenCalledTimes(1);

    // 1 回目の実行中に来た要求。
    request();
    await vi.advanceTimersByTimeAsync(200);
    // 1 回目がまだ実行中なので、この時点ではまだ 1 回のまま。
    expect(run).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });

  it("run が reject しても running が戻り、次の要求は走る (onError にエラーが渡る)", async () => {
    let call = 0;
    const run = vi.fn(async () => {
      call += 1;

      if (call === 1) {
        throw new Error("boom");
      }
    });
    const onError = vi.fn();
    const request = createRunQueue(run, 200, onError);

    request();
    await vi.advanceTimersByTimeAsync(200);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(run).toHaveBeenCalledTimes(1);

    // reject 後の次の要求。
    request();
    await vi.advanceTimersByTimeAsync(200);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("実行中に要求が来て、その実行が reject しても次の 1 回が走る", async () => {
    let call = 0;
    let resolveFirst: (() => void) | undefined;
    const run = vi.fn(() => {
      call += 1;

      if (call === 1) {
        return new Promise<void>((_resolve, reject) => {
          resolveFirst = () => reject(new Error("boom"));
        });
      }

      return Promise.resolve();
    });
    const onError = vi.fn();
    const request = createRunQueue(run, 200, onError);

    request();
    await vi.advanceTimersByTimeAsync(200);
    expect(run).toHaveBeenCalledTimes(1);

    // 1 回目の実行中 (reject する前) に来た要求。
    request();
    await vi.advanceTimersByTimeAsync(200);
    // 1 回目がまだ実行中なので、この時点ではまだ 1 回のまま。
    expect(run).toHaveBeenCalledTimes(1);

    resolveFirst?.();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });
});
