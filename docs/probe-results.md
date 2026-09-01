# Remotion 長尺・大容量ドラレコ動画 検証結果

実行日: 2026-09-02

## 実行環境

- OS: Linux (WSL2)
- Node.js: v24.19.0
- npm: 11.17.0
- ffmpeg / ffprobe: 9.0.1 (`/home/ansanloms/.nix-profile/bin/`)
- remotion / @remotion/cli / @remotion/media: 4.0.520
- react / react-dom: 19.2.3
- ファイルシステム: `/mnt/c` は 9P (WSL2 の Windows ドライブマウント)、`/` (ホーム配下) は ext4

## 素材の諸元

- 元ファイル: `/mnt/c/dev/movie/20260813_浄土平/assets/movies/DASHCAM_20260816_133345_466_541(1).mp4`
- サイズ: 8,055,732,618 bytes (約 8.06 GB decimal / 7.50 GiB)
- コーデック: hevc, 1920x1080, 24fps
- 長さ: 2564.375 秒 (約 42 分 44 秒)
- キーフレーム間隔の実測 (先頭 60 秒、`ffprobe -skip_frame nokey`): 0.0, 1.0, 2.0, ... 59.0 秒と 1 秒間隔で 60 個検出。GOP = 24 フレーム (24fps 相当) で 1 秒ごとにキーフレームが入る構成。

## 準備コスト表

| 項目 | 内容 | 所要時間 (real) | 備考 |
| --- | --- | --- | --- |
| `npm i` | 依存関係インストール | 40.698 秒 | - |
| `npx remotion add @remotion/media` | @remotion/media 4.0.520 追加 | 8.587 秒 | - |
| dd 読み取り (9P, 元ファイル先頭 1GiB) | `dd if=... of=/dev/null bs=1M count=1024` | 23.844 秒 | 45.1 MB/s (decimal) |
| cp (9P → ext4, 8.1GB) | 元ファイルを `public/probe-b.mp4` へ複製 | 6:07.15 (367.15 秒) | 実効スループット 約 21.9 MB/s (後述の外挿参照) |
| dd 読み取り (ext4, probe-b.mp4 先頭 1GiB) | 同上 dd をコピー後ファイルに実行 | 1.878 秒 | 573 MB/s (decimal) |
| ffmpeg 変換 (H.264 プロキシ、先頭 1200 秒分) | `probe-b.mp4` → `probe-c.mp4` (fps=30, libx264 veryfast crf22, g=30, aac 128k, faststart) | 41:00.52 (2460.52 秒) | speed=0.5003x (実時間の約 2.05 倍)。出力サイズ 3,181,492,911 bytes (約 3.18 GB decimal / 2.96 GiB)、コンテナ総計約 21.2Mbps。映像ストリーム単体は ffprobe では実測しておらず、コンテナ総計約 21.2Mbps から音声 AAC 128kbps を差し引いた計算値の約 21.08Mbps は mux オーバーヘッドを含むため上限側の推定である |
| cp (ext4 → 9P, 3.2GB) | `probe-c.mp4` を `/mnt/c/dev/movie/probe-tmp/probe-d.mp4` へ複製 | 46.328 秒 | 実効スループット 約 68.7 MB/s (decimal) |

## 計測結果表

4 条件のうち、A (元 HEVC ファイルのシンボリックリンク経由)・D (H.264 プロキシのシンボリックリンク経由) は still の warmup 段階で 404 により失敗し、以降の計測をスキップした。B (元 HEVC ファイルの ext4 実体) は既定タイムアウト (28000ms) では warmup が失敗したが、`--timeout=120000` に引き上げると 57.057 秒で成功しており、編集用途に照らせば実用的とは言えない所要時間ではあるものの、実測不能ではない。以降の shallow 以降の計測を実測できたのは条件 C (H.264 プロキシ、ext4 実体) のみ。

**注記**: A/D の失敗はシンボリックリンクの配信拒否 (serve-handler の既定仕様、詳細は「失敗した項目とエラー全文」参照) によるものであり、9P 上のファイルそのものへの到達可否を検証した結果ではない。9P への到達可否は「9P 実測 (`--public-dir` 経由)」で別途実測した。

| 条件 | warmup (frame=0) | shallow 1 回目 (frame=1800) | shallow 2 回目 (frame=1800) | mid (frame=18000) | deep | 10 秒レンダー | レンダー出力実測 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A (HEVC, シンボリックリンク, 9P) | 失敗 (404、下記参照) | スキップ | スキップ | スキップ | スキップ | スキップ | スキップ |
| B (HEVC, 実体, ext4) | 失敗 (既定 28000ms 超過) → `--timeout=120000` で 57.057 秒 (下記参照) | スキップ | スキップ | スキップ | スキップ | スキップ | スキップ |
| C (H.264 プロキシ, 実体, ext4) | 5.560 秒 | 4.525 秒 | 4.571 秒 | 4.633 秒 (frame=18000) | 4.524 秒 (frame=34500) | 59.593 秒 (frames 18000-18299, 300フレーム) | 下記参照 |
| D (H.264 プロキシ, シンボリックリンク, 9P) | 失敗 (404、下記参照) | スキップ | スキップ | スキップ | スキップ | スキップ | スキップ |

条件 C のレンダー出力 (`out/render-c.mp4`) の `ffprobe` 実測:

- 映像ストリーム: codec=h264, 1920x1080, 30fps, duration=10.000000 秒, nb_frames=300
- 音声ストリーム: codec=aac, duration=10.048000 秒, nb_frames=471
- コンテナ (format): duration=10.048000 秒
- ファイルサイズ: 29,658,950 bytes (約 29.7 MB)

24fps ソース (プロキシ変換で 30fps 化済み) → 30fps コンポジションの対応関係は、300 フレーム/10 秒 = 30fps として一致している。

### 9P 実測 (`--public-dir` 経由)

`public/probe-d.mp4` (9P 上の実体へのシンボリックリンク) 経由では条件 D として上記の通り 404 で失敗するが、`--public-dir=/mnt/c/dev/movie/probe-tmp` で 9P 上のディレクトリを直接指定し、`probe-d.mp4` (H.264 プロキシの実体、シンボリックリンクではない) を参照した場合はすべて成功した。

```
npx remotion still Probe out/warm-9p.jpeg --frame=0 --props='{"src":"probe-d.mp4"}' --public-dir=/mnt/c/dev/movie/probe-tmp
```

| 項目 | 所要時間 (real) |
| --- | --- |
| warmup (frame=0) | 4.797 秒 |
| shallow 1 回目 (frame=1800) | 4.922 秒 |
| shallow 2 回目 (frame=1800) | 4.034 秒 |
| deep (frame=34500) | 3.947 秒 |
| 10 秒レンダー (frames=18000-18299) | 53.866 秒 |

条件 C (ext4 実体) の対応する所要時間 (warmup 5.560 秒、shallow 4.525/4.571 秒、deep 4.524 秒、10 秒レンダー 59.593 秒) と比較して顕著な遅延は見られない。ただし、9P の計測値が ext4 より速く出ている項目もあり、これは still/render が読む量が数十 MB 程度と小さく、直前の `cp` (probe-c → 9P 上の probe-d) によって Windows 側のキャッシュが温まっていた可能性を排除できていないためである。したがって言えるのは、この workload (still、および 300 フレームのレンダー) の範囲では 9P と ext4 の間に I/O 律速による差が観測されない、というところまでである。全尺レンダーのような大きな読み取りが発生する場合の挙動は本計測では検証していない。

## 失敗した項目とエラー全文

### 条件 A: `npx remotion still Probe out/warm-a.jpeg --frame=0 --props='{"src":"probe-a.mp4"}'`

`public/probe-a.mp4` は元の 8.1GB HEVC ファイルへのシンボリックリンク (`ln -sf`)。

```
Rendered 0/1
http://localhost:3000/public/probe-a.mp4  Failed to load resource: the server responded with a status of 404 (Not Found)
Rendered 0/1
Could not extract frame from compositor Error: Received a status code of 404 while downloading file http://localhost:3000/public/probe-a.mp4.
The response body was:
---
{"statusCode":404,"message":"The requested path (/tmp/remotion-webpack-bundle-hnc5Op/public/probe-a.mp4) could not be found"}
---
http://localhost:3000/proxy?src=http%3A%2F%2Flocalhost%3A3000%2Fpublic%2Fprobe-a.mp4&time=0&transparent=true&toneMapped=true  Failed to load resource: the server responded with a status of 500 (Internal Server Error)

An error occurred:
 Error  Received a status code of 404 while downloading file http://localhost:3000/public/probe-a.mp4.
The response body was:
---
{"statusCode":404,"message":"The requested path (/tmp/remotion-webpack-bundle-hnc5Op/public/probe-a.mp4) could not be found"}
---
    at readFile (node_modules/@remotion/renderer/dist/assets/read-file.js:59:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at readFile (node_modules/@remotion/renderer/dist/assets/read-file.js:59:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

`public` 配下のファイルは `/tmp/remotion-webpack-bundle-<hash>/public/` にバンドルされた上で静的配信される。bundler 自体はシンボリックリンクを bundle 先にシンボリックリンクとして再作成するが、配信を担う `@remotion/renderer` 内蔵の `serve-handler` はシンボリックリンクの配信を既定で拒否する設計 (`symlinks` オプションが既定で無効) になっており、これが 404 の原因である。対処はシンボリックリンクではなく実体を `public` 配下に配置するか、`--public-dir` で参照先ディレクトリを直接指定することである。

### 条件 B: `npx remotion still Probe out/warm-b.jpeg --frame=0 --props='{"src":"probe-b.mp4"}'`

`public/probe-b.mp4` は元ファイルを ext4 に複製した実体 (シンボリックリンクではない)。

```
Rendered 0/1
Rendered 0/1
Rendered 0/1

💡 Get help for this issue at https://remotion.dev/docs/troubleshooting/delay-render-proxy
💡 Get help for this issue at https://remotion.dev/docs/timeout

An error occurred:
 Error  A delayRender() "Fetching http://localhost:3000/proxy?src=http%3A%2F%2Flocalhost%3A3000%2Fpublic%2Fprobe-b.mp4&time=0&transparent=true&toneMapped=true from server" was called but not cleared after 28000ms. See https://remotion.dev/docs/timeout for help.
```

frame=0 (ファイル先頭) の取得であるにもかかわらず、既定の delayRender タイムアウト (28000ms) 以内に `/proxy` エンドポイントからの応答が返らず失敗した。ファイル自体はシンボリックリンクではなく 404 は発生していないため、条件 A/D とは別種の失敗 (プロキシ処理側のタイムアウト) である。

上記は既定タイムアウト (28000ms) での 1 回のみの結果だった。`--timeout=120000` (120 秒) に引き上げて再試行したところ成功した。

```
time npx remotion still Probe out/warm-b2.jpeg --frame=0 --props='{"src":"probe-b.mp4"}' --timeout=120000
```

所要時間 (real): 57.057 秒。すなわち、条件 B (元 HEVC ファイルの ext4 実体) の warmup は失敗ではなく、既定の 28000ms を超えて処理に時間がかかっていただけであり、タイムアウトを引き上げれば成功する。

### 条件 D: `npx remotion still Probe out/warm-d.jpeg --frame=0 --props='{"src":"probe-d.mp4"}'`

`public/probe-d.mp4` は `probe-c.mp4` (H.264 プロキシ) を `/mnt/c/dev/movie/probe-tmp/` にコピーしたものへのシンボリックリンク。

```
An error occurred:
 Error  Received a status code of 404 while downloading file http://localhost:3000/public/probe-d.mp4.
The response body was:
---
{"statusCode":404,"message":"The requested path (/tmp/remotion-webpack-bundle-XxlpOS/public/probe-d.mp4) could not be found"}
---
    at readFile (node_modules/@remotion/renderer/dist/assets/read-file.js:59:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at readFile (node_modules/@remotion/renderer/dist/assets/read-file.js:59:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

条件 A と同一の 404 エラー。原因も条件 A と同じで、serve-handler がシンボリックリンクの配信を既定で拒否するためである (詳細は条件 A の項を参照)。コーデックや配置先 (9P) に関わらず、`public` 配下のシンボリックリンクは失敗する。ただし、この失敗はシンボリックリンク経由でのアクセスに起因するものであり、9P 上のファイルへのアクセスそのものが不可能であることを意味しない (`--public-dir` で 9P 上のディレクトリを直接指定した場合の実測は「計測結果表」および「9P 実測 (--public-dir 経由)」を参照)。

## フォールバック経路の確認

条件 C (H.264 プロキシ、ext4 実体) の計測値が `@remotion/media` 本来の経路 (WebCodecs/Mediabunny 等) によるものか、OffthreadVideo へのフォールバックによるものかを確認するため、`--log=verbose` を付けて still を再実行しログを確認した。

```
npx remotion still Probe out/verify-c.jpeg --frame=1800 --props='{"src":"probe-c.mp4"}' --log=verbose
```

出力全文 (53 行) を `fallback|offthread|webcodec|mediabunny` (大小文字無視) で grep したところ、該当行は **0 件** だった。verbose ログにはバンドル・ブラウザ起動・delayRender のクリア・レンダリング進捗・クリーンアップの各段階のログは出力されているが、フォールバック発生を示す警告や、使用中の再生経路 (WebCodecs/Mediabunny/OffthreadVideo) を明示する行は含まれていなかった。

この判断の根拠として、`@remotion/media` はフォールバックが発生した場合に `"falling back to <OffthreadVideo>"` を含む警告ログを出す実装になっている (レビューでコード確認済み) が、この警告ログは main tab (`window.remotion_isMainTab`) でのみ出力され、フォールバックへの切り替え自体は警告の有無に関わらず無条件に行われる。したがって並列レンダー時の worker タブでは、フォールバックが発生していても警告ログには現れない可能性がある。また `/proxy` エンドポイントは `@remotion/renderer` が持つ OffthreadVideo 用のフレーム抽出サーバである。これらを踏まえると、次の 2 点が言える。

1. この still 実行 (frame=1800、1 プロセス) は verbose ログに該当警告が 0 件だったことから、`@remotion/media` 本来の経路 (フォールバックなし) で処理されたと判断できる。ただし「警告 0 件 = フォールバックなし」と判断できるのはこの単発 still (main tab で 1 プロセスのみ実行) に限られ、10 秒レンダー等の並列実行を伴う条件 C の計測全体についてはフォールバックの有無を確認できていない。
2. 条件 A/B/D の失敗ログに共通して現れる `http://localhost:3000/proxy?src=...&time=0&transparent=true&toneMapped=true` という URL は、`<Video>` (`@remotion/media`) がフレーム取得のために OffthreadVideo 用のフォールバック経路 (`/proxy` エンドポイント) を試行したことを示している。

## 数値からの外挿

以下はすべて実測値からの単純な比例計算であり、推奨や判断は含まない。

- **プロキシ変換の全尺 (2564.375 秒) への外挿**: 1200 秒分の変換に 2460.52 秒 (real) を要した (処理レート 2.050433 秒/ソース秒)。同レートで全尺を変換すると、2564.375 秒 × 2.050433 ≈ 5258.1 秒 (約 87 分 38 秒、1 時間 27 分 38 秒)。
- **プロキシ出力サイズの全尺への外挿**: 1200 秒分の出力が 3,181,492,911 bytes。同レート (2,651,244 bytes/ソース秒) で全尺を変換すると、2564.375 秒 × 2,651,244 bytes/秒 ≈ 6,799,908,000 bytes (約 6.80 GB decimal / 6.33 GiB)。
- **9P 読み取り速度の直接外挿と実測 cp の乖離**: dd による先頭 1GiB の読み取り速度は 45.1 MB/s (decimal) で、これを単純に全尺 (8,055,732,618 bytes) へ外挿すると 8,055,732,618 ÷ 45,100,000 ≈ 178.6 秒。一方、実際に 9P → ext4 へ cp した所要時間は 367.15 秒で、実効スループットは 8,055,732,618 ÷ 367.15 ≈ 21.9 MB/s (decimal)。dd の短時間サンプルから外挿した速度と、実際の全ファイルコピーの実効速度には約 2 倍の差がある。
- **ext4 → 9P (逆方向) の実効スループット**: `probe-c.mp4` (3,181,492,911 bytes) を ext4 から 9P (`/mnt/c/dev/movie/probe-tmp/`) へ cp した所要時間は 46.328 秒で、実効スループットは 3,181,492,911 ÷ 46.328 ≈ 68.7 MB/s (decimal)。同じ 9P マウントでも、9P→ext4 の読み取り方向 (約 21.9 MB/s 実効) より ext4→9P の書き込み方向の方が速い結果になっている。
- **ext4 上でのファイルサイズと still 所要時間の関係**: 条件 C (3.18GB, H.264, ext4) の still は shallow/mid/deep で 4.52〜4.63 秒の範囲に収まり、shallow の反復 2 回 (4.525 秒/4.571 秒) の差は 0.046 秒だった。対照として、より小さい probe-e (56MB, 30 秒分) の still (frame=600, 20 秒地点) は 4.298 秒。一方、9P 実測 (前述) では 3.947〜4.922 秒の範囲でばらつき、反復 (shallow 1 回目/2 回目) の差は 0.888 秒に達した。これらを踏まえると、シーク位置 (フレーム位置) やファイルサイズによる系統差があるとしても、この程度のばらつきと区別できる大きさでは観測されていない。なお probe-e は `-movflags +faststart` を付けずに生成されており、他の probe ファイルと生成条件が揃っていないため対照として非統制である点に注意する。

## NVENC による変換速度の追加計測

前回の計測 (プロキシ変換 1200 秒分、libx264 veryfast、speed=0.5003x) を踏まえ、GPU (RTX 3060、`/dev/dxg` あり、`ffmpeg -hwaccels` に `cuda` あり) による H.264 エンコードの高速化余地を計測した。

### エンコーダ/デコーダの確認

`ffmpeg -hide_banner -encoders | grep -i nvenc`:

```
 V....D av1_nvenc            NVIDIA NVENC av1 encoder (codec av1)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V....D hevc_nvenc           NVIDIA NVENC hevc encoder (codec hevc)
```

`ffmpeg -hide_banner -decoders | grep -i -E "cuvid|nvdec"`:

```
 V..... av1_cuvid            Nvidia CUVID AV1 decoder (codec av1)
 V..... h264_cuvid           Nvidia CUVID H264 decoder (codec h264)
 V..... hevc_cuvid           Nvidia CUVID HEVC decoder (codec hevc)
 V..... mjpeg_cuvid          Nvidia CUVID MJPEG decoder (codec mjpeg)
 V..... mpeg1_cuvid          Nvidia CUVID MPEG1VIDEO decoder (codec mpeg1video)
 V..... mpeg2_cuvid          Nvidia CUVID MPEG2VIDEO decoder (codec mpeg2video)
 V..... vc1_cuvid            Nvidia CUVID VC1 decoder (codec vc1)
 V..... vp8_cuvid            Nvidia CUVID VP8 decoder (codec vp8)
 V..... vp9_cuvid            Nvidia CUVID VP9 decoder (codec vp9)
 V..... mpeg4_cuvid          Nvidia CUVID MPEG4 decoder (codec mpeg4)
```

`h264_nvenc` / `hevc_nvenc` エンコーダと `hevc_cuvid` デコーダはいずれもビルドに含まれていた。

### 変換コマンドと結果

1 回目 (`-hwaccel cuda` 指定あり):

```
ffmpeg -y -hwaccel cuda -t 300 -i public/probe-b.mp4 -r 30 -c:v h264_nvenc -preset p4 -cq 23 -g 30 -c:a aac -b:a 128k -movflags +faststart public/probe-e.mp4
```

失敗した。エラー全文 (抜粋):

```
[CUDA @ 0x61fec90f9bc0] Cannot load libcuda.so.1
[CUDA @ 0x61fec90f9bc0] Could not dynamically load CUDA
Device creation failed: -1.
[vist#0:0/hevc @ 0x61fec9024880] [dec:hevc @ 0x61fec905c900] No device available for decoder: device type cuda needed for codec hevc.
[vist#0:0/hevc @ 0x61fec9024880] [dec:hevc @ 0x61fec905c900] Hardware device setup failed for decoder: Operation not permitted
Error opening output file public/probe-e.mp4.
Error opening output files: Operation not permitted
```

計画に従い、`-hwaccel cuda` を外してデコードを CPU のみにし (`-c:v h264_nvenc` は維持) 1 回だけ再試行した。

```
ffmpeg -y -t 300 -i public/probe-b.mp4 -r 30 -c:v h264_nvenc -preset p4 -cq 23 -g 30 -c:a aac -b:a 128k -movflags +faststart public/probe-e.mp4
```

この再試行も失敗した。エラー全文 (抜粋):

```
[h264_nvenc @ 0x5cebabd7c8c0] Cannot load libcuda.so.1
[vost#0:0/h264_nvenc @ 0x5cebabd7b680] [enc:h264_nvenc @ 0x5cebabd7ba00] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height.
[vf#0:0 @ 0x5cebabd86380] Error sending frames to consumers: Operation not permitted
[vf#0:0 @ 0x5cebabd86380] Task finished with error code: -1 (Operation not permitted)
[vost#0:0/h264_nvenc @ 0x5cebabd7b680] Task finished with error code: -22 (Invalid argument)
[out#0/mp4 @ 0x5cebabcaafc0] Nothing was written into output file, because at least one of its streams received no packets.
Conversion failed!
```

いずれも `libcuda.so.1` のロードに失敗しており、CUDA デバイスの初期化自体ができていない。出力ファイルは生成されなかった (2 回目試行時に 0 バイトのファイルが作成されたが空であることを確認し削除した)。

参考として確認した周辺情報 (原因の切り分けは行っていない):

- `nvidia-smi` は正常に GPU (NVIDIA GeForce RTX 3060, Driver Version: 591.86, CUDA Version: 13.1) を検出した。
- `/usr/lib/wsl/lib/libcuda.so.1` は存在し、`ldconfig -p | grep -i cuda` にも `libcuda.so.1 => /usr/lib/wsl/lib/libcuda.so.1` として登録されていた。
- 使用した `ffmpeg` は `/home/ansanloms/.nix-profile/bin/ffmpeg` (nix プロファイル配下)。

この時点で NVENC 変換は成功しておらず、Remotion still の同等性確認 (手順 3) は実施していない。

### 全尺への外挿

NVENC 変換が失敗したため、速度・出力サイズの実測値が無く、全尺 2564.375 秒への外挿は行えなかった。

## NVENC による変換速度の再計測 (LD_LIBRARY_PATH 指定あり)

上記の `Cannot load libcuda.so.1` は、`LD_LIBRARY_PATH=/usr/lib/wsl/lib` を付与することで解決した。原因は nix ビルドの ffmpeg が既定のライブラリ検索パスで WSL の libcuda.so.1 (`/usr/lib/wsl/lib` 配下) を解決できていなかったことである。

### 変換コマンドと結果

```
env LD_LIBRARY_PATH=/usr/lib/wsl/lib ffmpeg -y -hwaccel cuda -t 30 -i public/probe-b.mp4 -r 30 -c:v h264_nvenc -preset p4 -cq 23 -g 30 -c:a aac -b:a 128k public/probe-e.mp4
```

成功した。900 フレーム (30 秒 @30fps、dup=180)、最終 speed 5.16x、所要時間 (elapsed) 5.81 秒、出力サイズ 54,926KiB。`ffprobe` 実測によるビットレート: コンテナ総計 (format) 約 15.0Mbps (14,998,505 bps)、映像ストリーム単体は約 14.9Mbps (14,860,910 bps)。

### Remotion still の同等性確認

`public/probe-e.mp4` (上記コマンドで生成した 30 秒分の出力) を対象に、20 秒地点 (frame=600) の still 取得を実施した。

```
time npx remotion still Probe out/still-e.jpeg --frame=600 --props='{"src":"probe-e.mp4"}'
```

所要時間 (real): 4.298 秒。`out/still-e.jpeg` (269KB) が生成された。

`probe-e.mp4` の `ffprobe` 実測:

- 映像ストリーム: codec=h264, 1920x1080, 30fps, duration=30.000000 秒
- 音声ストリーム: codec=aac, duration=30.000000 秒
- コンテナ (format): duration=30.000000 秒

## NVENC による変換速度の計測 (1200 秒・libx264 との統制条件)

libx264 によるプロキシ変換 (先頭 1200 秒分、speed=0.5003x) と条件を揃えるため、NVENC でも同じ先頭 1200 秒分を変換して計測した。

### 変換コマンドと結果

```
env LD_LIBRARY_PATH=/usr/lib/wsl/lib ffmpeg -y -hwaccel cuda -t 1200 -i public/probe-b.mp4 -r 30 -c:v h264_nvenc -preset p4 -cq 23 -g 30 -c:a aac -b:a 128k -movflags +faststart public/probe-f.mp4
```

成功した。所要時間 (real) 227.58 秒 (3:47.58)、ffmpeg 報告の最終 speed=5.48x。`ffprobe` 実測:

- 出力サイズ: 2,340,581,230 bytes (約 2.34 GB decimal / 2.18 GiB)
- 映像ストリーム: codec=h264, 1920x1080, 30fps, duration=1200.000000 秒, ビットレート約 15.47Mbps (15,466,743 bps)
- 音声ストリーム: codec=aac, ビットレート約 128.3kbps
- コンテナ (format) 総計ビットレート: 約 15.60Mbps (15,603,874 bps)

`public/probe-e.mp4` (30 秒版) は削除せず残した。

### libx264 (条件 C 生成時) との比較

同じ先頭 1200 秒分の変換で、libx264 (veryfast, crf22) は 2460.52 秒 (real, speed=0.5003x)、NVENC (p4, cq23) は 227.58 秒 (real, speed=5.48x) だった。real 時間の比で NVENC は libx264 の約 10.81 倍 (2460.52 ÷ 227.58) 高速である。ただし、これはパイプライン全体 (libx264 側は `-hwaccel` 無しの CPU デコード、NVENC 側は `-hwaccel cuda` によるデコードを含む) の比較であり、エンコーダ単体の速度差ではない点に注意する。

また、この比較は品質動作点 (ビットレート) が異なる条件同士のものである点にも注意が必要である。libx264 (crf22) の映像ビットレートは、コンテナ総計約 21.2Mbps から音声 AAC 128kbps を差し引いた計算値 (準備コスト表参照) で約 21.08Mbps であり、これは mux オーバーヘッドを含むため上限側の推定である。これに対し、NVENC (cq23) の映像ビットレート約 15.5Mbps (15.47Mbps) は ffprobe による映像ストリームの実測値であり、NVENC の方が同じ「変換に要した時間」に対して低いビットレート (=情報量の少ない出力) を選択している。したがって「NVENC は libx264 の約 10.8 倍高速」という数値は、速度と品質を両方合わせた比較ではなく、デコード経路も含めたパイプライン全体の、それぞれのデフォルト的な動作点における処理速度の比較である点に留意する。

### 全尺への外挿

以下は実測値からの単純な比例計算であり、推奨や判断は含まない。

- **NVENC 変換の全尺 (2564.375 秒) への外挿 (所要時間)**: 1200 秒分の変換に 227.58 秒 (real) を要した (処理レート 0.18965 秒/ソース秒)。同レートで全尺を変換すると、2564.375 秒 × 0.18965 ≈ 486.3 秒 (約 8 分 6 秒)。この外挿は real 227.58 秒を基準にしており、換算すると 1200 ÷ 227.58 ≈ 5.27x に相当する。ffmpeg が報告した speed=5.48x とは値が異なるが、差の原因は本計測では特定していない。上記の外挿は (speed 表示ではなく) real 基準で行っている。
- **NVENC 変換出力サイズの全尺への外挿**: 1200 秒分の出力が 2,340,581,230 bytes。同レート (1,950,484 bytes/ソース秒) で全尺を変換すると、2564.375 秒 × 1,950,484 bytes/秒 ≈ 5,001,773,000 bytes (約 5.00 GB decimal / 4.66 GiB)。libx264 の外挿値 (約 6.80 GB decimal / 6.33 GiB) より小さいが、これは上記の通り品質動作点 (ビットレート) が異なることによる。

## fixture の再生成手順

本検証で使用した `public/probe-*.mp4` は git 管理対象外であり、以下のコマンドで再生成できる。

```bash
# probe-b: 元 HEVC ファイル (9P) の ext4 実体
cp "/mnt/c/dev/movie/20260813_浄土平/assets/movies/DASHCAM_20260816_133345_466_541(1).mp4" public/probe-b.mp4

# probe-c: H.264 プロキシ (libx264, 先頭 1200 秒分)
ffmpeg -y -t 1200 -i public/probe-b.mp4 -r 30 -c:v libx264 -preset veryfast -crf 22 -g 30 -c:a aac -b:a 128k -movflags +faststart public/probe-c.mp4

# probe-d: probe-c を 9P 上に配置し、public 配下からシンボリックリンクで参照
mkdir -p /mnt/c/dev/movie/probe-tmp
cp public/probe-c.mp4 /mnt/c/dev/movie/probe-tmp/probe-d.mp4
ln -sf /mnt/c/dev/movie/probe-tmp/probe-d.mp4 public/probe-d.mp4

# probe-e: NVENC 変換 (先頭 30 秒分)
env LD_LIBRARY_PATH=/usr/lib/wsl/lib ffmpeg -y -hwaccel cuda -t 30 -i public/probe-b.mp4 -r 30 -c:v h264_nvenc -preset p4 -cq 23 -g 30 -c:a aac -b:a 128k public/probe-e.mp4

# probe-f: NVENC 変換 (先頭 1200 秒分、libx264 との統制条件比較用)
env LD_LIBRARY_PATH=/usr/lib/wsl/lib ffmpeg -y -hwaccel cuda -t 1200 -i public/probe-b.mp4 -r 30 -c:v h264_nvenc -preset p4 -cq 23 -g 30 -c:a aac -b:a 128k -movflags +faststart public/probe-f.mp4
```

`probe-a.mp4` (元ファイルへのシンボリックリンク) は失敗条件の再現用であり、`ln -sf "/mnt/c/dev/movie/20260813_浄土平/assets/movies/DASHCAM_20260816_133345_466_541(1).mp4" public/probe-a.mp4` で作成できる。

なお、Studio (`npm run dev`) 上での体感確認用に、`src/Root.tsx` へ `Probe-B-hevc` (probe-b をフル尺で再生)・`Probe-E-nvenc` (probe-e を再生) を登録している。`Probe` (probe-c、1200 秒) をそのまま Studio での確認に使い、フル尺の検証は `Probe-B-hevc` (76932 フレーム) を使う。本文中の `Probe` 使用のコマンドはすべて frame 34500 以下 (および frames=18000-18299) で、現在の durationInFrames=36000 の範囲内にあるため、今回の変更で再現性は失われない。
