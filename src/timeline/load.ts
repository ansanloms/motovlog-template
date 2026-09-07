import { mergeVoice, timelineSchema, voiceSchema } from "./schema";
import type { VoicedTimeline } from "./schema";

// 環境変数未設定・空のときに読む project (ADR-0004)。
export const DEFAULT_PROJECT = "00000000-sample";

// ADR-0002 の slug 形式 (YYYYMMDD-<name>、ASCII 小文字の kebab-case)。
const SLUG_PATTERN = /^[0-9]{8}-[a-z0-9]+(-[a-z0-9]+)*$/;

// REMOTION_PROJECT (未設定・空なら DEFAULT_PROJECT) を検証して slug を返す。
export const resolveProjectSlug = (env: string | undefined): string => {
  if (!env) {
    return DEFAULT_PROJECT;
  }

  if (!SLUG_PATTERN.test(env)) {
    throw new Error(
      `REMOTION_PROJECT の形式が不正です (YYYYMMDD-<name> の形にしてください): ${env}`,
    );
  }

  return env;
};

// projects/<slug>/timeline.ts と voice.json を動的 import で読み、
// mergeVoice で合成した VoicedTimeline を返す (ADR-0002/0004/0006)。
// ディレクトリ部分をリテラルで書いた import() でないと Rspack が解決できない
// ため、テンプレートリテラルの形は変えないこと。
export const loadProject = async (slug: string): Promise<VoicedTimeline> => {
  let timelineModule: { default: unknown };

  try {
    timelineModule = await import(`../../projects/${slug}/timeline.ts`);
  } catch (cause) {
    // tsconfig の lib (ES2018) が Error の { cause } オプションの型を持たない
    // ため、コンストラクタ引数ではなくプロパティ代入で付ける。
    const message = cause instanceof Error ? cause.message : String(cause);
    const error = new Error(
      `project \`${slug}\` の timeline.ts を読み込めません: projects/${slug}/timeline.ts (${message})`,
    );
    (error as Error & { cause?: unknown }).cause = cause;
    throw error;
  }

  let voiceModule: { default: unknown };

  try {
    voiceModule = await import(`../../projects/${slug}/voice.json`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const error = new Error(
      `project \`${slug}\` の voice.json を読み込めません: projects/${slug}/voice.json (${message})`,
    );
    (error as Error & { cause?: unknown }).cause = cause;
    throw error;
  }

  const timeline = timelineSchema.parse(timelineModule.default);
  const voice = voiceSchema.parse(voiceModule.default);

  return mergeVoice(timeline, voice, slug);
};
