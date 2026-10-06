import "../test/setup.ts";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
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
  /** setTimeout を差し替える偽の時計。afterEach() で戻す。 */
  let time: FakeTime | undefined;

  /** 偽の時計を ms 進め、その間に積まれた microtask も流す。 */
  const tick = async (ms: number) => {
    await time?.tickAsync(ms);
  };

  /** 待ちの無い Promise の後続 (microtask) を流す。 */
  const flush = async () => {
    await time?.runMicrotasks();
  };

  beforeEach(() => {
    time = new FakeTime();
  });

  afterEach(() => {
    time?.restore();
    time = undefined;
  });

  it("連続した要求はデバウンスされ、1 回の実行にまとまる", async () => {
    const run = spy(async () => {});
    const onError = spy<unknown, [unknown], void>(() => {});
    const request = createRunQueue(run, 200, onError);

    request();
    request();
    request();

    await tick(200);

    assertSpyCalls(run, 1);
    assertSpyCalls(onError, 0);
  });

  it("実行中に来た要求は、終了後にもう 1 回だけ走る", async () => {
    let resolveFirst: (() => void) | undefined;
    const run = spy(
      () =>
        new Promise<void>((resolve) => {
          if (!resolveFirst) {
            resolveFirst = resolve;
            return;
          }

          resolve();
        }),
    );
    const request = createRunQueue(run, 200, () => {});

    request();
    await tick(200);
    assertSpyCalls(run, 1);

    // 1 回目の実行中に来た要求。
    request();
    await tick(200);
    // 1 回目がまだ実行中なので、この時点ではまだ 1 回のまま。
    assertSpyCalls(run, 1);

    resolveFirst?.();
    await flush();
    assertSpyCalls(run, 2);
  });

  it("run が reject しても running が戻り、次の要求は走る (onError にエラーが渡る)", async () => {
    let call = 0;
    const run = spy(() => {
      call += 1;

      if (call === 1) {
        return Promise.reject(new Error("boom"));
      }

      return Promise.resolve();
    });
    const onError = spy<unknown, [unknown], void>(() => {});
    const request = createRunQueue(run, 200, onError);

    request();
    await tick(200);
    await flush();
    assertSpyCalls(onError, 1);
    expect(onError.calls[0].args[0]).toBeInstanceOf(Error);
    assertSpyCalls(run, 1);

    // reject 後の次の要求。
    request();
    await tick(200);
    await flush();
    assertSpyCalls(run, 2);
    assertSpyCalls(onError, 1);
  });

  it("実行中に要求が来て、その実行が reject しても次の 1 回が走る", async () => {
    let call = 0;
    let resolveFirst: (() => void) | undefined;
    const run = spy(() => {
      call += 1;

      if (call === 1) {
        return new Promise<void>((_resolve, reject) => {
          resolveFirst = () => reject(new Error("boom"));
        });
      }

      return Promise.resolve();
    });
    const onError = spy<unknown, [unknown], void>(() => {});
    const request = createRunQueue(run, 200, onError);

    request();
    await tick(200);
    assertSpyCalls(run, 1);

    // 1 回目の実行中 (reject する前) に来た要求。
    request();
    await tick(200);
    // 1 回目がまだ実行中なので、この時点ではまだ 1 回のまま。
    assertSpyCalls(run, 1);

    resolveFirst?.();

    await flush();
    assertSpyCalls(onError, 1);
    await flush();
    assertSpyCalls(run, 2);
  });
});
