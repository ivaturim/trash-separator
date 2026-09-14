import type { VoiceLanguage } from "./settingsStore";

export type HistoryLine = {
  segregation: string;
  detail: string;
};

/**
 * Everything Voice Mode says, per language.
 *
 * The disposal instruction comes back from the classification API in English,
 * so in the other languages the sentence around it is translated but the
 * instruction itself is passed through as received.
 */
export type Phrasebook = {
  activated: string;
  help: string;
  didNotHear: string;
  analyzing: string;
  classificationFailed: string;
  offline: string;
  stopped: string;
  nothingClassified: string;
  askPrompt: string;
  askAnother: string;
  notUnderstood: string;
  openingCamera: string;
  openingGallery: string;
  cancelled: string;
  segregationWord: (segregation: string) => string;
  result: (args: {
    segregation: string;
    instruction: string;
    confidencePercent: number;
  }) => string;
  historyIntro: (count: number) => string;
  historyItem: (index: number, line: HistoryLine) => string;
  historyEmpty: string;
  impactSummary: (args: {
    totalItems: number;
    recycledItems: number;
    co2SavedKg: number;
  }) => string;
  impactEmpty: string;
};

const EN: Phrasebook = {
  activated:
    "Voice mode active. Say 'take a photo', 'choose a photo', 'my history', 'my impact', or 'help'.",
  help: "You can say: take a photo, choose a photo, my history, my impact, ask a question, or stop.",
  didNotHear: "I didn't hear you. Say 'take a photo' or 'help'.",
  analyzing: "Analyzing. This may take a few seconds.",
  classificationFailed: "Something went wrong. Would you like to retry?",
  offline:
    "Voice mode needs internet for classification. Please connect and try again.",
  stopped: "Voice mode off.",
  nothingClassified:
    "Nothing has been classified yet. Say 'take a photo' to start.",
  askPrompt: "What is your question about the last item you classified?",
  askAnother: "Would you like to ask another question? Say 'yes' or 'no'.",
  notUnderstood: "Sorry, I did not understand. Say 'help' to hear the commands.",
  openingCamera: "Opening the camera.",
  openingGallery: "Opening your photo library.",
  cancelled: "Cancelled.",
  segregationWord: (segregation) => segregation,
  result: ({ segregation, instruction, confidencePercent }) =>
    `This item is ${segregation}. ${instruction}. Confidence ${confidencePercent} percent. Would you like to ask a follow-up question, or classify another item?`,
  historyIntro: (count) =>
    `Here ${count === 1 ? "is" : "are"} your ${count} most recent ${count === 1 ? "item" : "items"}.`,
  historyItem: (index, line) => `${index}. ${line.segregation}. ${line.detail}.`,
  historyEmpty: "You have no classifications yet.",
  impactSummary: ({ totalItems, recycledItems, co2SavedKg }) =>
    `You have classified ${totalItems} items. ${recycledItems} were recyclable, saving about ${co2SavedKg} kilograms of carbon dioxide.`,
  impactEmpty: "You have no impact to report yet. Classify an item to start.",
};

const ES: Phrasebook = {
  activated:
    "Modo de voz activado. Di 'toma una foto', 'elegir foto', 'historial', 'mi impacto' o 'ayuda'.",
  help: "Puedes decir: toma una foto, elegir foto, historial, mi impacto, pregunta, o para.",
  didNotHear: "No te escuché. Di 'toma una foto' o 'ayuda'.",
  analyzing: "Analizando. Esto puede tardar unos segundos.",
  classificationFailed: "Algo salió mal. ¿Quieres intentarlo de nuevo?",
  offline:
    "El modo de voz necesita internet para clasificar. Conéctate e inténtalo de nuevo.",
  stopped: "Modo de voz desactivado.",
  nothingClassified:
    "Todavía no has clasificado nada. Di 'toma una foto' para empezar.",
  askPrompt: "¿Cuál es tu pregunta sobre el último objeto clasificado?",
  askAnother: "¿Quieres hacer otra pregunta? Di 'sí' o 'no'.",
  notUnderstood: "Lo siento, no entendí. Di 'ayuda' para escuchar los comandos.",
  openingCamera: "Abriendo la cámara.",
  openingGallery: "Abriendo tu galería.",
  cancelled: "Cancelado.",
  segregationWord: (segregation) =>
    segregation.toLowerCase().includes("recycl") ? "reciclable" : "basura",
  result: ({ segregation, instruction, confidencePercent }) =>
    `Este objeto es ${segregation}. ${instruction}. Confianza ${confidencePercent} por ciento. ¿Quieres hacer una pregunta o clasificar otro objeto?`,
  historyIntro: (count) => `Estos son tus ${count} objetos más recientes.`,
  historyItem: (index, line) => `${index}. ${line.segregation}. ${line.detail}.`,
  historyEmpty: "Todavía no tienes clasificaciones.",
  impactSummary: ({ totalItems, recycledItems, co2SavedKg }) =>
    `Has clasificado ${totalItems} objetos. ${recycledItems} eran reciclables, ahorrando unos ${co2SavedKg} kilos de dióxido de carbono.`,
  impactEmpty: "Todavía no hay impacto. Clasifica un objeto para empezar.",
};

const ZH: Phrasebook = {
  activated:
    "语音模式已开启。你可以说：拍照、选择照片、历史、我的影响，或者帮助。",
  help: "你可以说：拍照、选择照片、历史、我的影响、提问，或者停止。",
  didNotHear: "我没有听清。请说：拍照，或者帮助。",
  analyzing: "正在分析，请稍等几秒。",
  classificationFailed: "出错了。要重试吗？",
  offline: "语音模式需要联网才能分类。请连接网络后重试。",
  stopped: "语音模式已关闭。",
  nothingClassified: "还没有分类任何物品。请说：拍照。",
  askPrompt: "关于刚才分类的物品，你想问什么？",
  askAnother: "还要再问一个问题吗？请说：是，或者不。",
  notUnderstood: "抱歉，我没有理解。请说：帮助，来听可用的命令。",
  openingCamera: "正在打开相机。",
  openingGallery: "正在打开相册。",
  cancelled: "已取消。",
  segregationWord: (segregation) =>
    segregation.toLowerCase().includes("recycl") ? "可回收物" : "垃圾",
  result: ({ segregation, instruction, confidencePercent }) =>
    `这个物品是${segregation}。${instruction}。置信度百分之${confidencePercent}。你想提问，还是分类另一个物品？`,
  historyIntro: (count) => `以下是你最近的${count}个物品。`,
  historyItem: (index, line) => `第${index}个。${line.segregation}。${line.detail}。`,
  historyEmpty: "你还没有分类记录。",
  impactSummary: ({ totalItems, recycledItems, co2SavedKg }) =>
    `你已经分类了${totalItems}个物品，其中${recycledItems}个可回收，大约减少了${co2SavedKg}公斤二氧化碳。`,
  impactEmpty: "还没有影响数据。先分类一个物品吧。",
};

const HI: Phrasebook = {
  activated:
    "वॉइस मोड चालू है। कहें: फोटो लो, फोटो चुनो, इतिहास, मेरा प्रभाव, या मदद।",
  help: "आप कह सकते हैं: फोटो लो, फोटो चुनो, इतिहास, मेरा प्रभाव, सवाल, या बंद करो।",
  didNotHear: "मैंने सुना नहीं। कहें: फोटो लो, या मदद।",
  analyzing: "विश्लेषण हो रहा है। कुछ सेकंड लग सकते हैं।",
  classificationFailed: "कुछ गलत हो गया। क्या फिर से कोशिश करें?",
  offline:
    "वर्गीकरण के लिए इंटरनेट चाहिए। कनेक्ट करके फिर से कोशिश करें।",
  stopped: "वॉइस मोड बंद।",
  nothingClassified: "अभी तक कुछ वर्गीकृत नहीं हुआ। कहें: फोटो लो।",
  askPrompt: "पिछली वस्तु के बारे में आपका सवाल क्या है?",
  askAnother: "क्या आप एक और सवाल पूछना चाहेंगे? हाँ या नहीं कहें।",
  notUnderstood: "माफ़ कीजिए, मैं समझा नहीं। कमांड सुनने के लिए कहें: मदद।",
  openingCamera: "कैमरा खुल रहा है।",
  openingGallery: "गैलरी खुल रही है।",
  cancelled: "रद्द कर दिया।",
  segregationWord: (segregation) =>
    segregation.toLowerCase().includes("recycl") ? "पुनर्चक्रण योग्य" : "कचरा",
  result: ({ segregation, instruction, confidencePercent }) =>
    `यह वस्तु ${segregation} है। ${instruction}। विश्वास ${confidencePercent} प्रतिशत। क्या आप सवाल पूछना चाहेंगे, या दूसरी वस्तु वर्गीकृत करना चाहेंगे?`,
  historyIntro: (count) => `ये आपकी ${count} हाल की वस्तुएं हैं।`,
  historyItem: (index, line) => `${index}. ${line.segregation}। ${line.detail}।`,
  historyEmpty: "अभी तक कोई वर्गीकरण नहीं है।",
  impactSummary: ({ totalItems, recycledItems, co2SavedKg }) =>
    `आपने ${totalItems} वस्तुएं वर्गीकृत की हैं। ${recycledItems} पुनर्चक्रण योग्य थीं, जिससे लगभग ${co2SavedKg} किलोग्राम कार्बन डाइऑक्साइड बची।`,
  impactEmpty: "अभी कोई प्रभाव नहीं है। शुरू करने के लिए एक वस्तु वर्गीकृत करें।",
};

const PHRASEBOOKS: Record<VoiceLanguage, Phrasebook> = {
  en: EN,
  es: ES,
  zh: ZH,
  hi: HI,
};

export function phrasesFor(language: VoiceLanguage): Phrasebook {
  return PHRASEBOOKS[language] ?? EN;
}
