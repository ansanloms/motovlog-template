import { describe, expect, it, vi } from "vitest";
import {
  checkDuplicateOutputs,
  ConvertAbortedError,
  encodeArgs,
  gopFromFps,
  nvencEnv,
  outputName,
  parseConvertArgs,
  probeArgs,
  PROJECT_SLUG_PATTERN,
  runConvert,
} from "./plan.ts";
import type { ConvertDeps } from "./plan.ts";

describe("PROJECT_SLUG_PATTERN", () => {
  it("正しい形式 (YYYYMMDD-<name>) の slug にマッチする", () => {
    expect(PROJECT_SLUG_PATTERN.test("20260817-jododaira")).toBe(true);
  });

  it("ハイフン区切りの複数語の name にもマッチする", () => {
    expect(PROJECT_SLUG_PATTERN.test("20260817-foo-bar")).toBe(true);
  });

  it("書式に合わない slug にはマッチしない", () => {
    expect(PROJECT_SLUG_PATTERN.test("bad slug")).toBe(false);
  });

  it("日付部分が 8 桁でない slug にはマッチしない", () => {
    expect(PROJECT_SLUG_PATTERN.test("2026081-jododaira")).toBe(false);
  });
});

describe("parseConvertArgs", () => {
  it("(1) --fps 省略時は既定の 30fps になる", () => {
    expect(parseConvertArgs(["20260817-jododaira", "a.mp4"])).toEqual({
      slug: "20260817-jododaira",
      inputs: ["a.mp4"],
      fps: 30,
    });
  });

  it("(2) --fps=<n> を指定すればその値になり、inputs は複数取れる", () => {
    expect(
      parseConvertArgs(["--fps=60", "20260817-jododaira", "a.mp4", "b.mp4"]),
    ).toEqual({
      slug: "20260817-jododaira",
      inputs: ["a.mp4", "b.mp4"],
      fps: 60,
    });
  });

  it("(3) --fps が数値でなければ throw する", () => {
    expect(() =>
      parseConvertArgs(["--fps=abc", "20260817-jododaira", "a.mp4"]),
    ).toThrow("--fps は正の数にしてください: abc");
  });

  it("(4) slug が書式に合わなければ throw する", () => {
    expect(() => parseConvertArgs(["bad slug", "a.mp4"])).toThrow(
      "slug は YYYYMMDD-<name> (ASCII 小文字の kebab-case) の形にしてください: bad slug",
    );
  });

  it("(5) inputs が空なら throw する", () => {
    expect(() => parseConvertArgs(["20260817-jododaira"])).toThrow(
      "usage: npm run convert -- [--fps=<n>] <slug> <入力ファイル>...",
    );
  });

  it("(6) --fps を空白区切りで渡すと不明なオプションとして throw する", () => {
    expect(() =>
      parseConvertArgs(["--fps", "60", "20260817-jododaira", "a.mp4"]),
    ).toThrow("不明なオプションです: --fps");
  });

  it("(7) 未知の -- オプションは throw する", () => {
    expect(() =>
      parseConvertArgs(["--xyz", "20260817-jododaira", "a.mp4"]),
    ).toThrow("不明なオプションです: --xyz");
  });

  it("(8) --help は null を返す", () => {
    expect(parseConvertArgs(["--help"])).toBeNull();
  });

  it("(8b) -h も null を返す", () => {
    expect(parseConvertArgs(["-h", "x"])).toBeNull();
  });

  it("(8c) --help は他の引数の検証より先に効く", () => {
    expect(parseConvertArgs(["--fps=abc", "--help"])).toBeNull();
  });

  it("(9) --fps= (値なし) は throw する", () => {
    expect(() =>
      parseConvertArgs(["--fps=", "20260817-jododaira", "a.mp4"]),
    ).toThrow("--fps の値が空です: --fps=");
  });
});

describe("gopFromFps", () => {
  it("四捨五入した値を返す", () => {
    expect(gopFromFps(29.97)).toBe(30);
  });

  it("丸めた値が 1 未満なら拒否する", () => {
    expect(() => gopFromFps(0.4)).toThrow(
      "--fps が不正です (正の数で、丸めた値が 1 以上): 0.4",
    );
  });
});

describe("outputName", () => {
  it("basename から最後の拡張子を除く", () => {
    expect(outputName("a/b/c.mp4")).toBe("c");
  });

  it("拡張子が無ければそのまま返す", () => {
    expect(outputName("c")).toBe("c");
  });

  it("拡張子だけのファイル名は拒否する", () => {
    expect(() => outputName(".mp4")).toThrow(
      "ファイル名が拡張子だけです: .mp4",
    );
  });
});

describe("checkDuplicateOutputs", () => {
  it("同じ出力名になる入力を拒否する", () => {
    expect(() => checkDuplicateOutputs(["x.mp4", "x.mov"])).toThrow(
      "出力先 (x.mp4) が重複しています: x.mp4 と x.mov",
    );
  });

  it("出力名が異なれば許可する", () => {
    expect(() => checkDuplicateOutputs(["x.mp4", "y.mov"])).not.toThrow();
  });
});

describe("nvencEnv", () => {
  it("LD_LIBRARY_PATH が無ければ /usr/lib/wsl/lib を設定する", () => {
    expect(nvencEnv({}).LD_LIBRARY_PATH).toBe("/usr/lib/wsl/lib");
  });

  it("LD_LIBRARY_PATH が有れば前に足す", () => {
    expect(nvencEnv({ LD_LIBRARY_PATH: "/existing" }).LD_LIBRARY_PATH).toBe(
      "/usr/lib/wsl/lib:/existing",
    );
  });
});

describe("probeArgs", () => {
  it("fps・gop を反映した ffmpeg 引数を返す", () => {
    expect(probeArgs(30, 30)).toEqual([
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:size=320x240:rate=30",
      "-r",
      "30",
      "-c:v",
      "h264_nvenc",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "p4",
      "-cq",
      "23",
      "-g",
      "30",
      "-f",
      "null",
      "-",
    ]);
  });
});

describe("encodeArgs", () => {
  it("nvenc の ffmpeg 引数を返す", () => {
    expect(
      encodeArgs({
        encoder: "nvenc",
        input: "in.mp4",
        output: "out.mp4",
        fps: 30,
        gop: 30,
      }),
    ).toEqual([
      "-y",
      "-hwaccel",
      "cuda",
      "-i",
      "in.mp4",
      "-r",
      "30",
      "-c:v",
      "h264_nvenc",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "p4",
      "-cq",
      "23",
      "-g",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "out.mp4",
    ]);
  });

  it("libx264 の ffmpeg 引数を返す", () => {
    expect(
      encodeArgs({
        encoder: "libx264",
        input: "in.mp4",
        output: "out.mp4",
        fps: 30,
        gop: 30,
      }),
    ).toEqual([
      "-y",
      "-i",
      "in.mp4",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-g",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "out.mp4",
    ]);
  });
});

describe("runConvert", () => {
  type Call = { args: string[]; env: NodeJS.ProcessEnv };

  const makeDeps = (
    ffmpegImpl: (call: Call, index: number) => number,
    existingOutputs: string[] = [],
  ) => {
    const calls: Call[] = [];
    const renames: Array<{ from: string; to: string }> = [];
    const unlinks: string[] = [];
    const logs: string[] = [];
    const warns: string[] = [];

    const deps: ConvertDeps = {
      ffmpeg: vi.fn((args: string[], env: NodeJS.ProcessEnv) => {
        const call = { args, env };
        calls.push(call);
        return Promise.resolve(ffmpegImpl(call, calls.length - 1));
      }),
      exists: (p) => existingOutputs.includes(p),
      mkdir: vi.fn(),
      rename: vi.fn((from: string, to: string) => {
        renames.push({ from, to });
      }),
      unlink: vi.fn((p: string) => {
        unlinks.push(p);
      }),
      log: vi.fn((line: string) => {
        logs.push(line);
      }),
      warn: vi.fn((line: string) => {
        warns.push(line);
      }),
      env: {},
      onTmp: vi.fn(),
    };

    return { deps, calls, renames, unlinks, logs, warns };
  };

  it("(a) probe 成功・2 本とも nvenc 成功なら nvenc で done する", async () => {
    const { deps, calls, renames, logs, warns } = makeDeps(() => 0);

    await runConvert(
      { inputs: ["a.mp4", "b.mkv"], outDir: "/out", fps: 30, gop: 30 },
      deps,
    );

    const doneLogs = logs.filter((line) => line.startsWith("done:"));
    expect(doneLogs).toEqual([
      "done: /out/a.mp4 (nvenc)",
      "done: /out/b.mp4 (nvenc)",
    ]);
    expect(renames).toEqual([
      { from: "/out/.tmp.a.mp4", to: "/out/a.mp4" },
      { from: "/out/.tmp.b.mp4", to: "/out/b.mp4" },
    ]);
    expect(warns).toEqual([]);
    // probe + 2 本の nvenc encode = 3 回。
    expect(calls).toHaveLength(3);
  });

  it("(b) 1 本目の nvenc が失敗したら libx264 で再試行し、以降は libx264 で統一する", async () => {
    const { deps, calls, logs, warns } = makeDeps((call, index) => {
      // 0: probe, 1: a.mp4 nvenc (失敗), 2: a.mp4 libx264 再試行 (成功),
      // 3: b.mkv libx264 (成功、encoder がラッチされているので最初から libx264)。
      if (index === 1) {
        return 1;
      }
      return 0;
    });

    await runConvert(
      { inputs: ["a.mp4", "b.mkv"], outDir: "/out", fps: 30, gop: 30 },
      deps,
    );

    expect(logs.filter((line) => line.startsWith("done:"))).toEqual([
      "done: /out/a.mp4 (libx264)",
      "done: /out/b.mp4 (libx264)",
    ]);
    expect(warns).toEqual([
      "warn: nvenc に失敗したため libx264 で再試行します: a.mp4",
      "warn: 以降のファイルは libx264 で変換します",
    ]);

    const nvencCalls = calls.filter((call) => call.args.includes("h264_nvenc"));
    // probe (1 回) + a.mp4 の nvenc 試行 (1 回) = 2 回。b.mkv は最初から libx264。
    expect(nvencCalls).toHaveLength(2);
  });

  it("(c) probe 失敗なら全部 libx264 で変換する", async () => {
    const { deps, calls, logs, warns } = makeDeps((call, index) =>
      index === 0 ? 1 : 0,
    );

    await runConvert(
      { inputs: ["a.mp4", "b.mkv"], outDir: "/out", fps: 30, gop: 30 },
      deps,
    );

    expect(logs.filter((line) => line.startsWith("done:"))).toEqual([
      "done: /out/a.mp4 (libx264)",
      "done: /out/b.mp4 (libx264)",
    ]);
    expect(warns).toEqual(["warn: nvenc が使えないため libx264 で変換します"]);
    // probe 自体は h264_nvenc で打つので 1 回だけ含まれる。encode 側には含まれない。
    expect(
      calls.filter((call) => call.args.includes("h264_nvenc")),
    ).toHaveLength(1);
  });

  it("(d) 出力が既に存在する入力は skip し、ffmpeg を呼ばない", async () => {
    const { deps, calls, logs } = makeDeps(() => 0, ["/out/a.mp4"]);

    await runConvert(
      { inputs: ["a.mp4", "b.mkv"], outDir: "/out", fps: 30, gop: 30 },
      deps,
    );

    expect(logs).toContain("skip: /out/a.mp4 は既に存在します");
    // probe (1 回) + b.mkv の encode (1 回) = 2 回。a.mp4 は skip されるので
    // encode は呼ばれない。
    expect(calls).toHaveLength(2);
  });

  it("(e) nvenc 失敗後の libx264 再試行も失敗したら Error を投げ、tmp を unlink する", async () => {
    const { deps, unlinks, warns } = makeDeps((call, index) => {
      // 0: probe (成功、encoder は nvenc), 1: a.mp4 nvenc (失敗),
      // 2: a.mp4 libx264 再試行 (失敗)。
      if (index === 0) {
        return 0;
      }
      return 1;
    });

    await expect(
      runConvert({ inputs: ["a.mp4"], outDir: "/out", fps: 30, gop: 30 }, deps),
    ).rejects.toThrow("ffmpeg が失敗しました (exit 1): a.mp4");

    expect(unlinks).toEqual(["/out/.tmp.a.mp4"]);
    expect(warns).toContain(
      "warn: nvenc に失敗したため libx264 で再試行します: a.mp4",
    );
  });

  it("(f) rename が失敗したら tmp を unlink し、onTmp(null) を通知したうえで例外を投げる", async () => {
    const { deps, unlinks } = makeDeps(() => 0);
    const renameError = new Error("rename に失敗しました");
    deps.rename = vi.fn(() => {
      throw renameError;
    });

    await expect(
      runConvert({ inputs: ["a.mp4"], outDir: "/out", fps: 30, gop: 30 }, deps),
    ).rejects.toThrow(renameError);

    expect(unlinks).toEqual(["/out/.tmp.a.mp4"]);
    expect(deps.onTmp).toHaveBeenLastCalledWith(null);
  });

  it("(g) probe 失敗で libx264 に固定後、libx264 の encode が失敗したら Error を投げ、tmp を unlink する", async () => {
    const { deps, unlinks, warns } = makeDeps(() => 1);

    await expect(
      runConvert({ inputs: ["a.mp4"], outDir: "/out", fps: 30, gop: 30 }, deps),
    ).rejects.toThrow("ffmpeg が失敗しました (exit 1): a.mp4");

    expect(unlinks).toEqual(["/out/.tmp.a.mp4"]);
    expect(warns).toEqual(["warn: nvenc が使えないため libx264 で変換します"]);
  });

  it("(h) nvenc encode 中に abort されたら ConvertAbortedError を投げ、libx264 の再試行はせず tmp を unlink する", async () => {
    const controller = new AbortController();
    const { deps, calls, unlinks, warns, logs } = makeDeps((call, index) => {
      // 0: probe (成功), 1: a.mp4 nvenc encode (この呼び出し中に abort)。
      if (index === 1) {
        controller.abort();
        return 1;
      }
      return 0;
    });

    await expect(
      runConvert(
        {
          inputs: ["a.mp4"],
          outDir: "/out",
          fps: 30,
          gop: 30,
          signal: controller.signal,
        },
        deps,
      ),
    ).rejects.toThrow(ConvertAbortedError);

    // probe + a.mp4 の nvenc encode の 2 回だけ。abort により libx264 の
    // 再試行 (3 回目の呼び出し) は起きない。
    expect(calls).toHaveLength(2);
    expect(unlinks).toEqual(["/out/.tmp.a.mp4"]);
    expect(warns).not.toContain(
      "warn: nvenc に失敗したため libx264 で再試行します: a.mp4",
    );
    expect(logs.filter((line) => line.startsWith("done:"))).toEqual([]);
  });

  it("(i) 1 本目の変換成功直後に abort されたら、2 本目の ffmpeg を呼ばずに ConvertAbortedError を投げる", async () => {
    const controller = new AbortController();
    const { deps, calls } = makeDeps(() => 0);
    const rename = deps.rename;
    deps.rename = vi.fn((from: string, to: string) => {
      rename(from, to);
      // a.mp4 の rename (= 1 本目の成功) 直後に abort する。
      controller.abort();
    });

    await expect(
      runConvert(
        {
          inputs: ["a.mp4", "b.mkv"],
          outDir: "/out",
          fps: 30,
          gop: 30,
          signal: controller.signal,
        },
        deps,
      ),
    ).rejects.toThrow(ConvertAbortedError);

    // probe + a.mp4 の nvenc encode の 2 回だけ。b.mkv の ffmpeg は呼ばれない。
    expect(calls).toHaveLength(2);
  });
});
