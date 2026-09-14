import {
  matchLocalIntent,
  parseYesNo,
  type Intent,
} from "./intentParser";

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
}

function expectIntent(
  transcript: string,
  intent: Intent,
  language: "en" | "es" | "zh" | "hi" = "en",
) {
  const parsed = matchLocalIntent(transcript, language);
  check(
    `"${transcript}" → ${intent}`,
    parsed.intent === intent,
    `got ${parsed.intent}`,
  );
}

const CASES: [string, Intent][] = [
  ["take a photo", "TAKE_PHOTO"],
  ["TAKE PHOTO", "TAKE_PHOTO"],
  ["scan this", "TAKE_PHOTO"],
  ["classify", "TAKE_PHOTO"],
  ["camera please", "TAKE_PHOTO"],
  ["choose a photo", "CHOOSE_PHOTO"],
  ["pick from gallery", "CHOOSE_PHOTO"],
  ["album", "CHOOSE_PHOTO"],
  ["my history", "HISTORY"],
  ["recent items", "HISTORY"],
  ["what did I classify", "HISTORY"],
  ["my impact", "IMPACT"],
  ["how much have I recycled", "IMPACT"],
  ["carbon", "IMPACT"],
  ["help", "HELP"],
  ["what can you do", "HELP"],
  ["ask a question", "ASK"],
  ["chat", "ASK"],
  ["explain more", "ASK"],
  ["stop", "STOP"],
  ["exit voice mode", "STOP"],
  ["never mind", "STOP"],
];

for (const [transcript, intent] of CASES) {
  expectIntent(transcript, intent);
}

// Longest match: "classify" alone is a photo, but this sentence is history.
expectIntent("what did I classify yesterday", "HISTORY");

expectIntent("", "UNKNOWN");
expectIntent("   ", "UNKNOWN");
expectIntent("asdfghjkl", "UNKNOWN");
expectIntent("what is the weather", "UNKNOWN");

expectIntent("toma una foto", "TAKE_PHOTO", "es");
expectIntent("ayuda", "HELP", "es");
expectIntent("拍照", "TAKE_PHOTO", "zh");
expectIntent("帮助", "HELP", "zh");
expectIntent("फोटो लो", "TAKE_PHOTO", "hi");
expectIntent("मदद", "HELP", "hi");

// English still works when another language is selected.
expectIntent("take a photo", "TAKE_PHOTO", "es");

check("yes", parseYesNo("Yes please") === "yes");
check("no first", parseYesNo("no thanks") === "no");
check("empty yes/no", parseYesNo("") === null);
check("gibberish yes/no", parseYesNo("xyz") === null);

console.log(failures === 0 ? "\nAll intentParser checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
