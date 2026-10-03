// Automatic expense categorisation.
// Looks at the expense description (strongest signal), the vendor name, and
// the category of any saved vendor with the same name, then picks the best of
// the five expense categories used across FinSight.

export const EXPENSE_CATEGORIES = [
  "Raw materials",
  "Labour & wages",
  "Transport & logistics",
  "Utilities",
  "Other overheads",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

interface Rule {
  category: ExpenseCategory;
  // Words that clearly point to this category (weight 3)
  strong: string[];
  // Words that usually point to this category (weight 1.5)
  weak: string[];
}

const RULES: Rule[] = [
  {
    category: "Raw materials",
    strong: [
      "raw material", "raw materials", "raw", "cardboard", "corrugated", "kraft",
      "granules", "polymer", "resin", "adhesive", "glue", "pigment", "yarn",
      "fabric", "cloth", "timber", "plywood", "steel", "aluminium", "aluminum",
      "flour", "sugar", "ingredients", "packaging material", "गत्ता", "कच्चा माल",
      "कच्चा", "कागद", "कागज",
    ],
    weak: [
      "material", "materials", "sheet", "sheets", "paper", "plastic", "ink",
      "board", "thread", "wood", "iron", "metal", "chemical", "stock", "supplies",
      "supply", "goods", "माल", "सामग्री",
    ],
  },
  {
    category: "Labour & wages",
    strong: [
      "salary", "salaries", "wage", "wages", "payroll", "labour", "labor",
      "overtime", "stipend", "bonus", "मजदूरी", "मजूर", "पगार", "वेतन",
      "कामगार", "तनख्वाह",
    ],
    weak: [
      "worker", "workers", "staff", "employee", "employees", "helper",
      "contractor", "manpower", "hamali", "हमाली", "कर्मचारी",
    ],
  },
  {
    category: "Transport & logistics",
    strong: [
      "diesel", "petrol", "fuel", "freight", "transport", "logistics", "courier",
      "shipping", "toll", "fastag", "cartage", "lorry", "truck", "tempo",
      "delhivery", "bluedart", "dtdc", "डीज़ल", "डीजल", "डिझेल", "पेट्रोल",
      "वाहतूक", "ट्रक", "भाड़ा", "भाडे",
    ],
    weak: [
      "delivery", "deliveries", "vehicle", "loading", "unloading", "cab",
      "taxi", "parking", "dispatch", "टेम्पो",
    ],
  },
  {
    category: "Utilities",
    strong: [
      "electricity", "electric bill", "light bill", "power bill", "water bill",
      "internet", "broadband", "wifi", "wi-fi", "lpg", "mseb", "mahavitaran",
      "bescom", "tata power", "adani electricity", "बिजली", "वीज", "इंटरनेट",
    ],
    weak: [
      "power", "water", "gas", "phone bill", "mobile bill", "recharge",
      "electric", "पानी", "पाणी",
    ],
  },
  {
    category: "Other overheads",
    strong: [
      "rent", "insurance", "gst", "income tax", "licence", "license",
      "software", "subscription", "audit", "accountant", "accounting", "legal",
      "advertising", "advertisement", "marketing", "stationery", "repair", "repairs",
      "maintenance", "किराया",
      "भाडेपट्टी",
    ],
    weak: [
      "office", "cleaning", "security",
      "tea", "snacks", "tax", "fees", "fee", "bank charges", "interest",
    ],
  },
];

const DESCRIPTION_WEIGHT = 2;
const VENDOR_WEIGHT = 1;
const SAVED_VENDOR_BONUS = 3;

function hasLatin(word: string) {
  return /^[a-z0-9\- ]+$/.test(word);
}

function matches(text: string, tokens: string[], word: string): boolean {
  // Phrases and non-English words: simple "contains" check.
  if (!hasLatin(word) || word.includes(" ") || word.includes("-")) {
    return text.includes(word);
  }
  // Short English words must match a whole word ("gas", "raw", "tea", "cab").
  if (word.length <= 4) return tokens.includes(word);
  // Longer words also match their endings ("sheets", "deliveries" via "delivery").
  return tokens.some((token) => token.startsWith(word));
}

function scoreField(text: string, weight: number): Record<string, number> {
  const scores: Record<string, number> = {};
  const clean = text.toLowerCase().trim();
  if (!clean) return scores;
  const tokens = clean.split(/[^a-z0-9\u0900-\u097f]+/).filter(Boolean);
  for (const rule of RULES) {
    let score = 0;
    for (const word of rule.strong)
      if (matches(clean, tokens, word)) score += 3 * weight;
    for (const word of rule.weak)
      if (matches(clean, tokens, word)) score += 1.5 * weight;
    if (score) scores[rule.category] = score;
  }
  return scores;
}

export interface CategorySuggestion {
  category: ExpenseCategory;
  /** false when nothing recognisable was found and we fell back to "Other overheads" */
  matched: boolean;
  /** where the decision came from, for a small hint in the UI */
  source: "description" | "vendor" | "saved vendor" | "none";
}

export function suggestExpenseCategory(
  description: string,
  vendor: string = "",
  savedVendors: { name: string; category: string }[] = [],
): CategorySuggestion {
  const total: Record<string, number> = {};
  const add = (scores: Record<string, number>) => {
    for (const [category, value] of Object.entries(scores))
      total[category] = (total[category] ?? 0) + value;
  };

  const fromDescription = scoreField(description, DESCRIPTION_WEIGHT);
  const fromVendor = scoreField(vendor, VENDOR_WEIGHT);
  add(fromDescription);
  add(fromVendor);

  // If the vendor is already saved, trust the category stored for it.
  let usedSavedVendor = false;
  const vendorKey = vendor.trim().toLowerCase();
  if (vendorKey) {
    const saved = savedVendors.find((v) => v.name.trim().toLowerCase() === vendorKey);
    if (saved && (EXPENSE_CATEGORIES as readonly string[]).includes(saved.category)) {
      total[saved.category] = (total[saved.category] ?? 0) + SAVED_VENDOR_BONUS;
      usedSavedVendor = true;
    }
  }

  const ranked = Object.entries(total).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return { category: "Other overheads", matched: false, source: "none" };
  }
  const best = ranked[0][0] as ExpenseCategory;
  const source: CategorySuggestion["source"] = fromDescription[best]
    ? "description"
    : usedSavedVendor && !fromVendor[best]
      ? "saved vendor"
      : "vendor";
  return { category: best, matched: true, source };
}
