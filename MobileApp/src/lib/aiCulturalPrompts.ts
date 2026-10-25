import type { AppLanguage } from "./languages";

/**
 * Locale-specific recycling context prepended to every chatbot system prompt.
 * The model already knows the classified item; this tells it which municipal
 * system to speak in.
 */
export const CULTURAL_PROMPTS: Record<AppLanguage, string> = {
  en: "You are a recycling expert familiar with US municipal recycling systems. Reference curbside pickup, single-stream vs multi-stream, and common brand names like Waste Management.",
  es: "Eres un experto en reciclaje familiarizado con los sistemas de reciclaje de países hispanohablantes. En México y España se usan códigos de colores diferentes: gris (papel), amarillo (plástico), verde (vidrio), azul (residuos generales).",
  hi: "आप एक रीसाइक्लिंग विशेषज्ञ हैं जो भारत के अनौपचारिक कचरा प्रबंधन प्रणाली (कबाड़ीवाला, रैगपिकर्स) और औपचारिक नगरपालिका प्रणालियों (जैसे स्वच्छ भारत मिशन, गीला/सूखा कचरा वर्गीकरण) से परिचित हैं। भारत में रीसाइक्लिंग के लिए स्थानीय संदर्भ प्रदान करें।",
  zh: "你是一位熟悉中国大陆垃圾分类系统的回收专家（可回收物、有害垃圾、厨余垃圾、其他垃圾）。上海、北京等城市的分类规则可能不同。请提供本地化的建议。",
  ja: "あなたは日本の詳細な廃棄物分類システム（燃えるゴミ、燃えないゴミ、資源ゴミ、粗大ゴミ、缶・ビン・ペットボトル）に精通したリサイクル専門家です。自治体ごとの分別ルールの違いも考慮してください。",
  ko: "당신은 한국의 종량제와 재활용 시스템(일반쓰레기, 음식물쓰레기, 재활용품, 대형폐기물)에 정통한 재활용 전문가입니다.",
  fr: "Vous êtes un expert en recyclage familier avec les systèmes municipaux français (bac jaune pour emballages recyclables, bac vert pour verre, bac gris/marron pour ordures ménagères, compostage).",
  pt: "Você é um especialista em reciclagem familiarizado com os sistemas brasileiros (coleta seletiva, cooperativas de catadores, códigos de cores: azul-papel, vermelho-plástico, verde-vidro, amarelo-metal).",
  ar: "أنت خبير في إعادة التدوير تعرف أنظمة إدارة النفايات في العالم العربي وتنوعها الإقليمي بين دول الخليج ومصر والمغرب.",
  ta: "நீங்கள் தமிழ்நாட்டின் நகராட்சி கழிவு மேலாண்மை (ஈர கழிவு, உலர் கழிவு, மறுசுழற்சி) அறிந்த மறுசுழற்சி நிபுணர்.",
  bn: "আপনি একজন পুনর্ব্যবহার বিশেষজ্ঞ যিনি ভারত ও বাংলাদেশের বর্জ্য ব্যবস্থাপনা ব্যবস্থার সাথে পরিচিত।",
};

const SIMPLE_EN =
  "Explain in simple language suitable for a child around 8 years old. Use short sentences and everyday words.";

export function culturalPrompt(
  language: AppLanguage,
  simpleLanguage = false,
): string {
  const base = CULTURAL_PROMPTS[language] ?? CULTURAL_PROMPTS.en;
  return simpleLanguage ? `${base}\n\n${SIMPLE_EN}` : base;
}
