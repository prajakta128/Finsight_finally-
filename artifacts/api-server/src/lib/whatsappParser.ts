/**
 * Turns a free-text WhatsApp message like "paid 500 for diesel" into a
 * structured entry, and builds the reply text (English / Hindi / Marathi).
 *
 * Pure functions only: no database, no network. Rule-based on purpose, so
 * it is free, instant, works offline, and behaves predictably in a demo.
 */

export type Lang = "en" | "hi" | "mr";

export type ParsedMessage =
  | { kind: "undo" }
  | { kind: "help" }
  | { kind: "unknown"; reason: "no_amount" | "no_type" }
  | {
      kind: "expense" | "revenue";
      amount: number;
      category: string;
      description: string;
      vendor: string | null;
      customer: string | null;
    };

// ---------- language detection ----------

const DEVANAGARI = /[\u0900-\u097F]/;
const MARATHI_MARKERS = ["आहे", "मिळाले", "मिळाली", "दिले", "दिली", "केले", "खरेदी", "विकले", "विकला", "भरले", "ला ", "साठी"];
const HINDI_MARKERS = ["है", "मिले", "मिला", "दिए", "दिये", "दिया", "किया", "खरीदा", "खरीदे", "बेचा", "बेचे", "को ", "के लिए"];

export function detectLang(text: string): Lang {
  if (!DEVANAGARI.test(text)) return "en";
  const mr = MARATHI_MARKERS.filter((m) => text.includes(m)).length;
  const hi = HINDI_MARKERS.filter((m) => text.includes(m)).length;
  return mr > hi ? "mr" : "hi";
}

// ---------- amount ----------

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

function asciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

const THOUSAND_WORDS = ["k", "thousand", "hazar", "hajar", "हज़ार", "हजार"];
const LAKH_WORDS = ["lakh", "lakhs", "lac", "lacs", "लाख"];

export function extractAmount(text: string): number | null {
  const t = asciiDigits(text);
  const match = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|hazar|hajar|lakhs?|lacs?|हज़ार|हजार|लाख)?(?![a-z])/i);
  if (!match) return null;
  let value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? "").toLowerCase();
  if (THOUSAND_WORDS.includes(unit)) value *= 1000;
  if (LAKH_WORDS.includes(unit)) value *= 100000;
  return Math.round(value * 100) / 100;
}

// ---------- expense vs revenue ----------

const REVENUE_PHRASES = ["got paid", "paid me", "paid by", "payment received", "payment from"];

const REVENUE_WORDS = [
  "sold", "sale", "sales", "received", "receive", "earned", "earn", "income",
  "revenue", "collected", "collection", "bikri", "bika", "becha", "mila", "mile",
  "मिले", "मिला", "बेचा", "बेचे", "बिक्री", "विक्री", "कमाई", "कमाया", "वसूल",
  "मिळाले", "मिळाली", "विकले", "विकला",
];

const EXPENSE_WORDS = [
  "paid", "pay", "spent", "spend", "bought", "buy", "purchase", "purchased",
  "expense", "cost", "gave", "given", "kharch", "kharcha", "kharida", "diya",
  "दिए", "दिये", "दिया", "खर्च", "खरीदा", "खरीदे", "खरेदी", "दिले", "दिली", "भरले",
];

function countHits(lower: string, words: string[]): number {
  return words.filter((w) => {
    if (DEVANAGARI.test(w)) return lower.includes(w);
    return new RegExp(`\\b${w}\\b`, "i").test(lower);
  }).length;
}

// Words that are almost always an expense even without a verb like "paid":
// "salary 12000", "rent 15000", "diesel 500".
const IMPLICIT_EXPENSE_WORDS = [
  "rent", "salary", "salaries", "wages", "diesel", "petrol", "fuel", "electricity",
  "repair", "repairs", "maintenance", "freight", "chai", "tea", "किराया", "भाडे", "भाडं",
];

function detectType(lower: string): "expense" | "revenue" | null {
  if (REVENUE_PHRASES.some((p) => lower.includes(p))) return "revenue";
  const rev = countHits(lower, REVENUE_WORDS);
  const exp = countHits(lower, EXPENSE_WORDS);
  if (rev > 0 || exp > 0) return rev > exp ? "revenue" : "expense";
  if (countHits(lower, IMPLICIT_EXPENSE_WORDS) > 0) return "expense";
  if (detectCategory(lower) !== "Other overheads") return "expense";
  return null;
}

// ---------- category (must match the app's dropdown categories) ----------

const CATEGORY_KEYWORDS: { category: string; words: string[] }[] = [
  {
    category: "Raw materials",
    words: ["material", "materials", "raw", "cardboard", "sheet", "sheets", "paper", "glue", "plastic", "polymer", "granules", "ink", "गत्ता", "गत्ते", "कच्चा", "कागज", "कागद", "माल"],
  },
  {
    category: "Labour & wages",
    words: ["salary", "salaries", "wage", "wages", "labour", "labor", "worker", "workers", "staff", "payroll", "overtime", "मजदूरी", "मजूर", "पगार", "वेतन", "कामगार", "तनख्वाह"],
  },
  {
    category: "Transport & logistics",
    words: ["diesel", "petrol", "fuel", "transport", "freight", "delivery", "truck", "tempo", "courier", "logistics", "shipping", "toll", "डीज़ल", "डीजल", "डिझेल", "पेट्रोल", "वाहतूक", "ट्रक", "भाड़ा"],
  },
  {
    category: "Utilities",
    words: ["electricity", "electric", "power", "water", "internet", "wifi", "gas", "बिजली", "वीज", "पानी", "पाणी", "इंटरनेट"],
  },
];

export function detectCategory(lower: string): string {
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (countHits(lower, words) > 0) return category;
  }
  return "Other overheads";
}

// ---------- vendor / customer name ----------

const NAME_STOP = "(?=\\s+(?:for|on|of|against|today|yesterday|at|via|by|towards)\\b|[,.;]|$)";

function extractName(text: string, preps: string[]): string | null {
  const re = new RegExp(
    `\\b(?:${preps.join("|")})\\s+([A-Za-z][A-Za-z0-9&.'-]*(?:\\s+[A-Za-z][A-Za-z0-9&.'-]*){0,3}?)${NAME_STOP}`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  return m[1]
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------- main entry point ----------

export function parseMessage(rawText: string): ParsedMessage {
  const text = (rawText ?? "").trim();
  const lower = text.toLowerCase();

  if (["undo", "cancel", "delete last", "remove last"].includes(lower)) {
    return { kind: "undo" };
  }
  if (["help", "hi", "hello", "hey", "menu", "start", "मदत", "मदद", "नमस्ते"].includes(lower)) {
    return { kind: "help" };
  }

  const amount = extractAmount(text);
  if (amount === null) return { kind: "unknown", reason: "no_amount" };

  const type = detectType(lower);
  if (type === null) return { kind: "unknown", reason: "no_type" };

  const description = text.length > 140 ? `${text.slice(0, 137)}...` : text;

  if (type === "revenue") {
    return {
      kind: "revenue",
      amount,
      category: "Revenue",
      description,
      vendor: null,
      customer: extractName(text, ["from", "to", "by"]),
    };
  }
  return {
    kind: "expense",
    amount,
    category: detectCategory(lower),
    description,
    vendor: extractName(text, ["to"]),
    customer: null,
  };
}

// ---------- replies ----------

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type Reply = Record<Lang, string>;

export function replyLogged(
  lang: Lang,
  p: { kind: "expense" | "revenue"; amount: number; category: string; description: string },
): string {
  const a = inr(p.amount);
  const tpl: Reply =
    p.kind === "expense"
      ? {
          en: `✅ *FinSight* logged expense ${a} — ${p.category}\n"${p.description}"\n\nMade a mistake? Reply UNDO.`,
          hi: `✅ *FinSight* ने खर्च दर्ज किया ${a} — ${p.category}\n"${p.description}"\n\nगलती हुई? UNDO लिखें।`,
          mr: `✅ *FinSight* ने खर्च नोंदवला ${a} — ${p.category}\n"${p.description}"\n\nचूक झाली? UNDO लिहा.`,
        }
      : {
          en: `✅ *FinSight* logged revenue ${a}\n"${p.description}"\n\nMade a mistake? Reply UNDO.`,
          hi: `✅ *FinSight* ने कमाई दर्ज की ${a}\n"${p.description}"\n\nगलती हुई? UNDO लिखें।`,
          mr: `✅ *FinSight* ने कमाई नोंदवली ${a}\n"${p.description}"\n\nचूक झाली? UNDO लिहा.`,
        };
  return tpl[lang];
}

export function replyUndone(lang: Lang, description: string): string {
  return {
    en: `↩️ Removed: "${description}"`,
    hi: `↩️ हटा दिया: "${description}"`,
    mr: `↩️ काढून टाकले: "${description}"`,
  }[lang];
}

export function replyNothingToUndo(lang: Lang): string {
  return {
    en: "Nothing to undo right now.",
    hi: "अभी हटाने के लिए कुछ नहीं है।",
    mr: "सध्या काढण्यासाठी काहीही नाही.",
  }[lang];
}

export function replyHelp(lang: Lang): string {
  return {
    en: "*FinSight* — your business's money assistant 💼\n\nJust message me the way you'd tell a friend:\n• paid 500 for diesel\n• spent 20k on raw material\n• sold goods 25000 to Patel Traders\n\nI log it, sort it into the right category, and update your dashboard instantly.\n\nहिंदी में भी लिखें • मराठीतही लिहा\nMade a mistake? Reply UNDO.",
    hi: "*FinSight* — आपके व्यवसाय का पैसों का साथी 💼\n\nबस ऐसे लिखें जैसे किसी दोस्त को बताते हैं:\n• डीज़ल पर 500 खर्च किए\n• कच्चे माल पर 20 हज़ार खर्च\n• 25000 का माल बेचा\n\nमैं इसे दर्ज करता हूँ, सही श्रेणी में डालता हूँ और आपका डैशबोर्ड तुरंत अपडेट करता हूँ।\n\nगलती हुई? UNDO लिखें।",
    mr: "*FinSight* — तुमच्या व्यवसायाचा पैशांचा साथीदार 💼\n\nमित्राला सांगितल्यासारखे लिहा:\n• डिझेलवर 500 खर्च केले\n• कच्च्या मालावर 20 हजार खर्च\n• 25000 चा माल विकला\n\nमी ते नोंदवतो, योग्य वर्गात टाकतो आणि तुमचा डॅशबोर्ड लगेच अपडेट करतो.\n\nचूक झाली? UNDO लिहा.",
  }[lang];
}

export function replyUnknown(lang: Lang, reason: "no_amount" | "no_type"): string {
  if (reason === "no_amount") {
    return {
      en: "I couldn't find an amount in that message. Try: paid 500 for diesel",
      hi: "मुझे संदेश में राशि नहीं मिली। ऐसे लिखें: डीज़ल पर 500 खर्च किए",
      mr: "संदेशात रक्कम सापडली नाही. असे लिहा: डिझेलवर 500 खर्च केले",
    }[lang];
  }
  return {
    en: "Was that money spent or money received? Try: paid 500 for diesel, or sold goods for 2000",
    hi: "यह पैसा खर्च हुआ या मिला? ऐसे लिखें: 500 खर्च किए, या 2000 का माल बेचा",
    mr: "हे पैसे खर्च झाले की मिळाले? असे लिहा: 500 खर्च केले, किंवा 2000 चा माल विकला",
  }[lang];
}

export function replyNotLinked(lang: Lang, phone: string): string {
  return {
    en: `This number (${phone}) isn't linked to a FinSight workspace yet. Open FinSight → Settings → Connect WhatsApp and save this number.`,
    hi: `यह नंबर (${phone}) अभी किसी FinSight वर्कस्पेस से जुड़ा नहीं है। FinSight → Settings → Connect WhatsApp में यह नंबर सेव करें।`,
    mr: `हा नंबर (${phone}) अजून कोणत्याही FinSight वर्कस्पेसशी जोडलेला नाही. FinSight → Settings → Connect WhatsApp मध्ये हा नंबर सेव्ह करा.`,
  }[lang];
}

/** Escapes text so it is safe inside the XML reply Twilio expects. */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
