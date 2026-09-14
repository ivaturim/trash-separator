import { ChatRequestError, hasApiKey, requestAssistantReply } from "./openaiClient";
import type { VoiceLanguage } from "./settingsStore";

export type Intent =
  | "TAKE_PHOTO"
  | "CHOOSE_PHOTO"
  | "HISTORY"
  | "IMPACT"
  | "HELP"
  | "ASK"
  | "STOP"
  | "UNKNOWN";

export type IntentSource = "local" | "openai" | "none";

export type ParsedIntent = {
  intent: Intent;
  source: IntentSource;
  /** The keyword that matched, for the debug inspector. */
  matched?: string;
};

type KnownIntent = Exclude<Intent, "UNKNOWN">;

type KeywordMap = Record<KnownIntent, string[]>;

const EN: KeywordMap = {
  TAKE_PHOTO: [
    "take a photo",
    "take photo",
    "take a picture",
    "camera",
    "scan this",
    "scan",
    "classify this",
    "classify",
    "capture",
  ],
  CHOOSE_PHOTO: [
    "choose photo",
    "choose a photo",
    "pick photo",
    "pick a photo",
    "gallery",
    "from gallery",
    "select photo",
    "album",
    "library",
  ],
  HISTORY: [
    "history",
    "recent",
    "recent items",
    "past items",
    "my classifications",
    "what did i classify",
  ],
  IMPACT: [
    "impact",
    "my impact",
    "environmental impact",
    "how much",
    "how much have i recycled",
    "co2",
    "carbon",
  ],
  HELP: ["help", "commands", "what can you do", "options", "menu"],
  ASK: [
    "ask",
    "ask a question",
    "question",
    "chat",
    "talk",
    "explain more",
    "tell me more",
  ],
  STOP: [
    "stop",
    "quit",
    "exit",
    "cancel",
    "never mind",
    "voice off",
    "deactivate",
    "exit voice mode",
  ],
};

const ES: KeywordMap = {
  TAKE_PHOTO: [
    "toma una foto",
    "tomar foto",
    "haz una foto",
    "sacar foto",
    "camara",
    "cámara",
    "escanear",
    "clasificar",
    "clasifica esto",
  ],
  CHOOSE_PHOTO: [
    "elegir foto",
    "elige una foto",
    "escoger foto",
    "galeria",
    "galería",
    "de la galeria",
    "album",
    "álbum",
  ],
  HISTORY: ["historial", "recientes", "elementos recientes", "mis clasificaciones"],
  IMPACT: ["impacto", "mi impacto", "impacto ambiental", "cuanto he reciclado", "carbono"],
  HELP: ["ayuda", "comandos", "que puedes hacer", "qué puedes hacer", "opciones", "menu", "menú"],
  ASK: ["pregunta", "preguntar", "hacer una pregunta", "conversar", "explica mas", "explica más"],
  STOP: ["para", "parar", "detener", "salir", "cancelar", "olvidalo", "olvídalo", "apagar voz"],
};

/**
 * Mandarin is written without spaces, so these are matched as substrings
 * rather than on word boundaries.
 */
const ZH: KeywordMap = {
  TAKE_PHOTO: ["拍照", "拍一张", "照相", "扫描", "分类这个", "分类"],
  CHOOSE_PHOTO: ["选择照片", "相册", "从相册", "选图片", "图库"],
  HISTORY: ["历史", "最近", "最近的项目", "我的分类"],
  IMPACT: ["影响", "环境影响", "我的影响", "回收了多少", "碳"],
  HELP: ["帮助", "命令", "你能做什么", "选项", "菜单"],
  ASK: ["提问", "问题", "聊天", "问一下", "详细说明"],
  STOP: ["停止", "退出", "取消", "关闭语音", "算了"],
};

const HI: KeywordMap = {
  TAKE_PHOTO: ["फोटो लो", "तस्वीर लो", "फोटो खींचो", "कैमरा", "स्कैन", "वर्गीकृत करो"],
  CHOOSE_PHOTO: ["फोटो चुनो", "गैलरी", "गैलरी से", "तस्वीर चुनो", "एलबम"],
  HISTORY: ["इतिहास", "हाल के", "हाल की वस्तुएं", "मेरे वर्गीकरण"],
  IMPACT: ["प्रभाव", "मेरा प्रभाव", "पर्यावरण प्रभाव", "कितना रीसायकल", "कार्बन"],
  HELP: ["मदद", "सहायता", "कमांड", "तुम क्या कर सकते हो", "विकल्प", "मेनू"],
  ASK: ["पूछो", "सवाल", "प्रश्न", "बात करो", "और बताओ"],
  STOP: ["रुको", "बंद करो", "बाहर", "रद्द करो", "छोड़ो"],
};

const KEYWORDS: Record<VoiceLanguage, KeywordMap> = {
  en: EN,
  es: ES,
  zh: ZH,
  hi: HI,
};

const YES_NO: Record<VoiceLanguage, { yes: string[]; no: string[] }> = {
  en: {
    yes: ["yes", "yeah", "yep", "sure", "ok", "okay", "another", "please do"],
    no: ["no", "nope", "nothing", "that is all", "thats all", "done", "stop"],
  },
  es: {
    yes: ["si", "sí", "claro", "vale", "por supuesto", "otra"],
    no: ["no", "nada", "eso es todo", "listo", "para"],
  },
  zh: {
    yes: ["是", "好", "好的", "可以", "再来", "继续"],
    no: ["不", "不要", "没有", "够了", "结束"],
  },
  hi: {
    yes: ["हाँ", "हां", "जी", "ठीक है", "और"],
    no: ["नहीं", "ना", "बस", "खत्म"],
  },
};

const PUNCTUATION = /[.,!?;:¿¡"'`´()[\]{}…—–\-。，、！？；：「」『』]/g;
const CJK = /[\u4e00-\u9fff]/;

/**
 * Keeps letters from every script — stripping anything non-ASCII would erase
 * the Mandarin and Hindi keyword sets entirely.
 */
function normalize(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseMatches(normalized: string, phrase: string): boolean {
  if (CJK.test(phrase)) return normalized.includes(phrase);
  return ` ${normalized} `.includes(` ${phrase} `);
}

/**
 * Longest match wins rather than first match, because synonyms overlap across
 * intents: "what did I classify" is a history request even though "classify"
 * on its own asks for a new photo.
 */
export function matchLocalIntent(
  transcript: string,
  language: VoiceLanguage = "en",
): ParsedIntent {
  const normalized = normalize(transcript);
  if (normalized.length === 0) return { intent: "UNKNOWN", source: "none" };

  // English stays in the search for every language: interfaces tend to be
  // discussed in a mix of languages, and the English words are unambiguous.
  const maps =
    language === "en" ? [KEYWORDS.en] : [KEYWORDS[language], KEYWORDS.en];

  let best: { intent: KnownIntent; phrase: string } | null = null;

  for (const map of maps) {
    for (const [intent, phrases] of Object.entries(map) as [
      KnownIntent,
      string[],
    ][]) {
      for (const phrase of phrases) {
        if (!phraseMatches(normalized, phrase)) continue;
        if (!best || phrase.length > best.phrase.length) {
          best = { intent, phrase };
        }
      }
    }
  }

  if (!best) return { intent: "UNKNOWN", source: "none" };
  return { intent: best.intent, source: "local", matched: best.phrase };
}

export function parseYesNo(
  transcript: string,
  language: VoiceLanguage = "en",
): "yes" | "no" | null {
  const normalized = normalize(transcript);
  if (normalized.length === 0) return null;

  const sets = language === "en" ? [YES_NO.en] : [YES_NO[language], YES_NO.en];

  // "No" is checked first: "no thanks" would otherwise trip an "ok" style
  // match in a longer sentence.
  for (const set of sets) {
    if (set.no.some((phrase) => phraseMatches(normalized, phrase))) return "no";
  }
  for (const set of sets) {
    if (set.yes.some((phrase) => phraseMatches(normalized, phrase))) return "yes";
  }
  return null;
}

const INTENTS: Intent[] = [
  "TAKE_PHOTO",
  "CHOOSE_PHOTO",
  "HISTORY",
  "IMPACT",
  "HELP",
  "ASK",
  "STOP",
  "UNKNOWN",
];

/**
 * Remote fallback for phrasings the keyword map does not cover.
 *
 * Every call costs a request, so anything seen often enough in the debug
 * inspector is worth promoting into the local map above — that path is free,
 * instant, and works offline.
 */
export async function classifyIntentWithOpenAI(
  transcript: string,
): Promise<Intent> {
  if (!hasApiKey()) return "UNKNOWN";

  try {
    const reply = await requestAssistantReply(
      "You classify voice commands for a recycling app. Reply with one intent name and nothing else.",
      [
        {
          id: "intent-classification",
          role: "user",
          content: `The user said: '${transcript}'. Classify their intent into one of: TAKE_PHOTO, CHOOSE_PHOTO, HISTORY, IMPACT, HELP, ASK, STOP, UNKNOWN. Reply with just the intent name.`,
          createdAt: new Date().toISOString(),
        },
      ],
    );

    const normalized = reply.trim().toUpperCase().replace(/[^A-Z_]/g, "");
    const match = INTENTS.find((intent) => normalized.includes(intent));
    return match ?? "UNKNOWN";
  } catch (error) {
    // A failed classification is not worth surfacing: the caller re-prompts,
    // which is the same thing the user would do anyway.
    if (error instanceof ChatRequestError) return "UNKNOWN";
    return "UNKNOWN";
  }
}

/**
 * Tries the free local matcher first and only pays for a model call when the
 * transcript says something the keyword map has never seen.
 */
export async function parseIntent(
  transcript: string,
  options: { language?: VoiceLanguage; allowRemote?: boolean } = {},
): Promise<ParsedIntent> {
  const { language = "en", allowRemote = true } = options;

  const local = matchLocalIntent(transcript, language);
  if (local.intent !== "UNKNOWN") return local;

  if (!allowRemote || normalize(transcript).length === 0) {
    return { intent: "UNKNOWN", source: "none" };
  }

  const intent = await classifyIntentWithOpenAI(transcript);
  return {
    intent,
    source: intent === "UNKNOWN" ? "none" : "openai",
  };
}
