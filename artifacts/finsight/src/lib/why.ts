/**
 * FinSight "Why?" engine.
 *
 * Every builder returns the SAME explanation in English, Hindi and Marathi,
 * written from the user's real numbers (never hard-coded sample values).
 *
 * Each explanation has two layers:
 *   1. Written layer  -> headline, "because" steps, meaning, next steps
 *   2. Voice layer    -> `voice`, a shorter, simpler script that is read aloud
 *
 * The voice script avoids symbols (₹, %, ×) and reads amounts as words, so
 * text-to-speech sounds natural in every language.
 */
import type { BusinessBootstrap } from "@workspace/api-client-react";
import type { calculateFinancials, ActionItem } from "./financials";
import type { Lang } from "./i18n";

type Fin = ReturnType<typeof calculateFinancials>;

export type WhyTone = "good" | "watch" | "risk" | "info";

export interface WhyStep {
  label: string;
  value?: string;
  detail: string;
}

export interface WhyBody {
  title: string;
  tone: WhyTone;
  headline: string;
  because: WhyStep[];
  meaning: string;
  next: string[];
  voice: string;
}

export type WhyContent = Record<Lang, WhyBody>;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const pick =
  (lang: Lang) =>
  <T,>(en: T, hi: T, mr: T): T =>
    lang === "en" ? en : lang === "hi" ? hi : mr;

/** Amount for reading on screen: ₹1.2L / ₹1.2 लाख / ₹45,000 (sign aware). */
function money(n: number, lang: Lang): string {
  const a = Math.abs(n);
  let s: string;
  if (a >= 100000) {
    const v = (a / 100000).toFixed(1).replace(/\.0$/, "");
    s = lang === "en" ? `₹${v}L` : `₹${v} लाख`;
  } else {
    s = `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(a)}`;
  }
  return n < 0 ? `-${s}` : s;
}

/** Amount for reading aloud: "1.2 lakh rupees" / "45,000 rupees". */
function say(n: number, lang: Lang): string {
  const a = Math.abs(n);
  if (a >= 100000) {
    const v = (a / 100000).toFixed(1).replace(/\.0$/, "");
    return lang === "en" ? `${v} lakh rupees` : `${v} लाख रुपये`;
  }
  const v = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(a);
  return lang === "en" ? `${v} rupees` : `${v} रुपये`;
}

const pct = (n: number) => `${Math.round(n)}%`;
const sayPct = (n: number, lang: Lang) =>
  `${Math.round(n)} ${pick(lang)("percent", "प्रतिशत", "टक्के")}`;

const isSettled = (status: string) =>
  /paid|cleared|collected|closed/i.test(status);
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

function latestDate(data: BusinessBootstrap): string {
  return data.transactions.length
    ? data.transactions.reduce(
        (latest, item) => (item.date > latest ? item.date : latest),
        data.transactions[0].date,
      )
    : new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* UI text used by the Why modal / button / notification bell          */
/* ------------------------------------------------------------------ */

export const WHY_UI: Record<
  Lang,
  {
    button: string;
    kicker: string;
    short: string;
    how: string;
    meaning: string;
    next: string;
    simple: string;
    listen: string;
    stop: string;
    slow: string;
    normal: string;
    close: string;
    noVoice: string;
    voiceUnsupported: string;
    tone: Record<WhyTone, string>;
    bellTitle: string;
    bellEmpty: string;
    enableAlerts: string;
    alertsOn: string;
    toastTitle: (n: number) => string;
    centreTitle: string;
  }
> = {
  en: {
    button: "Why?",
    kicker: "Why am I seeing this?",
    short: "The short answer",
    how: "How FinSight worked this out",
    meaning: "What this means for your business",
    next: "What you can do now",
    simple: "In simple words",
    listen: "Listen",
    stop: "Stop",
    slow: "Slow",
    normal: "Normal",
    close: "Close",
    noVoice:
      "This phone or computer has no voice installed for this language, so a similar voice is being used. Install the language voice in your device settings for best results.",
    voiceUnsupported: "Voice is not supported in this browser. Try Chrome or Edge.",
    tone: {
      good: "Looks good",
      watch: "Needs attention",
      risk: "Act soon",
      info: "Good to know",
    },
    bellTitle: "Notifications",
    bellEmpty: "You are all caught up. No new alerts.",
    enableAlerts: "Turn on phone / desktop alerts",
    alertsOn: "Phone / desktop alerts are on",
    toastTitle: (n) => `${n} new alert${n > 1 ? "s" : ""} need your attention`,
    centreTitle: "Why centre",
  },
  hi: {
    button: "क्यों?",
    kicker: "मुझे यह क्यों दिख रहा है?",
    short: "संक्षेप में जवाब",
    how: "FinSight ने यह कैसे निकाला",
    meaning: "आपके व्यवसाय के लिए इसका मतलब",
    next: "अभी आप क्या कर सकते हैं",
    simple: "आसान शब्दों में",
    listen: "सुनें",
    stop: "रोकें",
    slow: "धीरे",
    normal: "सामान्य",
    close: "बंद करें",
    noVoice:
      "इस फ़ोन या कंप्यूटर में इस भाषा की आवाज़ इंस्टॉल नहीं है, इसलिए मिलती-जुलती आवाज़ इस्तेमाल हो रही है। बेहतर नतीजे के लिए डिवाइस सेटिंग में भाषा की आवाज़ इंस्टॉल करें।",
    voiceUnsupported:
      "इस ब्राउज़र में आवाज़ की सुविधा नहीं है। Chrome या Edge आज़माएँ।",
    tone: {
      good: "ठीक है",
      watch: "ध्यान देने की ज़रूरत",
      risk: "जल्दी कदम उठाएँ",
      info: "जानने लायक",
    },
    bellTitle: "सूचनाएँ",
    bellEmpty: "सब ठीक है। कोई नया अलर्ट नहीं।",
    enableAlerts: "फ़ोन / डेस्कटॉप अलर्ट चालू करें",
    alertsOn: "फ़ोन / डेस्कटॉप अलर्ट चालू हैं",
    toastTitle: (n) => `${n} नए अलर्ट पर आपका ध्यान चाहिए`,
    centreTitle: "क्यों केंद्र",
  },
  mr: {
    button: "का?",
    kicker: "मला हे का दिसत आहे?",
    short: "थोडक्यात उत्तर",
    how: "FinSight ने हे कसे काढले",
    meaning: "तुमच्या व्यवसायासाठी याचा अर्थ",
    next: "आता तुम्ही काय करू शकता",
    simple: "सोप्या शब्दांत",
    listen: "ऐका",
    stop: "थांबवा",
    slow: "हळू",
    normal: "सामान्य",
    close: "बंद करा",
    noVoice:
      "या फोनमध्ये किंवा संगणकात या भाषेचा आवाज इन्स्टॉल नाही, म्हणून जवळचा आवाज वापरला जात आहे. चांगल्या निकालासाठी डिव्हाइस सेटिंगमध्ये भाषेचा आवाज इन्स्टॉल करा.",
    voiceUnsupported:
      "या ब्राउझरमध्ये आवाजाची सुविधा नाही. Chrome किंवा Edge वापरून पहा.",
    tone: {
      good: "छान आहे",
      watch: "लक्ष द्यावे लागेल",
      risk: "लवकर पावले उचला",
      info: "जाणून घ्यावे असे",
    },
    bellTitle: "सूचना",
    bellEmpty: "सर्व ठीक आहे. नवीन अलर्ट नाहीत.",
    enableAlerts: "फोन / डेस्कटॉप अलर्ट सुरू करा",
    alertsOn: "फोन / डेस्कटॉप अलर्ट सुरू आहेत",
    toastTitle: (n) => `${n} नवीन अलर्टकडे तुमचे लक्ष हवे`,
    centreTitle: "का केंद्र",
  },
};

/* ------------------------------------------------------------------ */
/* 1. Financial health score                                           */
/* ------------------------------------------------------------------ */

const FACTOR_LABEL: Record<string, Record<Lang, string>> = {
  cashFlow: {
    en: "Cash flow",
    hi: "नकदी प्रवाह (कैश फ्लो)",
    mr: "रोख प्रवाह",
  },
  liquidity: {
    en: "Cash in hand",
    hi: "हाथ में नकदी",
    mr: "हातातील रोख",
  },
  expenseControl: {
    en: "Spending control",
    hi: "खर्च पर नियंत्रण",
    mr: "खर्चावर नियंत्रण",
  },
  receivables: {
    en: "Customer payments",
    hi: "ग्राहकों से भुगतान",
    mr: "ग्राहकांकडून पेमेंट",
  },
  payables: {
    en: "Supplier bills",
    hi: "सप्लायर के बिल",
    mr: "पुरवठादारांची बिले",
  },
  budgetPerformance: {
    en: "Budget discipline",
    hi: "बजट अनुशासन",
    mr: "बजेट शिस्त",
  },
};

const FACTOR_TIP: Record<string, Record<Lang, string>> = {
  cashFlow: {
    en: "Cut your biggest expense category a little, or review your selling prices.",
    hi: "अपनी सबसे बड़ी खर्च श्रेणी थोड़ी कम करें, या बिक्री की कीमतों की समीक्षा करें।",
    mr: "तुमची सर्वात मोठी खर्चाची श्रेणी थोडी कमी करा, किंवा विक्री किमतींचा आढावा घ्या.",
  },
  liquidity: {
    en: "Keep more cash in hand by collecting dues faster and delaying non-urgent purchases.",
    hi: "बकाया जल्दी वसूल करें और गैर-ज़रूरी खरीद टालें ताकि हाथ में ज़्यादा नकदी रहे।",
    mr: "थकबाकी लवकर वसूल करा आणि गरज नसलेली खरेदी पुढे ढकला, म्हणजे हातात जास्त रोख राहील.",
  },
  expenseControl: {
    en: "Look at the Analytics page and find the category that is growing fastest.",
    hi: "Analytics पेज देखें और सबसे तेज़ बढ़ती खर्च श्रेणी ढूँढें।",
    mr: "Analytics पेज पहा आणि सर्वात वेगाने वाढणारी खर्चाची श्रेणी शोधा.",
  },
  receivables: {
    en: "Follow up on overdue invoices today, starting with the oldest and biggest.",
    hi: "आज ही बकाया बिलों पर फ़ॉलो-अप करें, सबसे पुराने और बड़े बिल से शुरू करें।",
    mr: "आजच थकीत बिलांचा पाठपुरावा करा, सर्वात जुन्या आणि मोठ्या बिलापासून सुरुवात करा.",
  },
  payables: {
    en: "Plan supplier payments around the days your customers pay you.",
    hi: "सप्लायर के भुगतान उन दिनों के हिसाब से तय करें जब ग्राहक आपको पैसे देते हैं।",
    mr: "ज्या दिवशी ग्राहक पैसे देतात त्या दिवसांनुसार पुरवठादारांची देणी ठरवा.",
  },
  budgetPerformance: {
    en: "Set a budget for each expense category so FinSight can warn you before you overspend.",
    hi: "हर खर्च श्रेणी के लिए बजट तय करें ताकि FinSight ज़्यादा खर्च से पहले आपको चेतावनी दे सके।",
    mr: "प्रत्येक खर्च श्रेणीसाठी बजेट ठरवा, म्हणजे जास्त खर्च होण्यापूर्वी FinSight तुम्हाला सावध करेल.",
  },
};

export function whyHealth(f: Fin, data: BusinessBootstrap): WhyContent {
  const mk = (lang: Lang): WhyBody => {
    const t = pick(lang);
    const M = (n: number) => money(n, lang);
    const title = t(
      "Your financial health score",
      "आपका फाइनेंशियल हेल्थ स्कोर",
      "तुमचा आर्थिक आरोग्य स्कोअर",
    );

    if (!f.populated) {
      return {
        title,
        tone: "info",
        headline: t(
          "There is no score yet because you have not added any records.",
          "अभी कोई स्कोर नहीं है क्योंकि आपने कोई रिकॉर्ड नहीं जोड़ा है।",
          "अजून स्कोअर नाही कारण तुम्ही कोणतीही नोंद जोडलेली नाही.",
        ),
        because: [
          {
            label: t("What the score needs", "स्कोर के लिए क्या चाहिए", "स्कोअरसाठी काय हवे"),
            detail: t(
              "The score compares your sales, spending, customer dues and supplier bills. With no records, there is nothing to compare.",
              "स्कोर आपकी बिक्री, खर्च, ग्राहकों के बकाया और सप्लायर के बिलों की तुलना करता है। रिकॉर्ड न हों तो तुलना के लिए कुछ नहीं है।",
              "स्कोअर तुमची विक्री, खर्च, ग्राहकांची थकबाकी आणि पुरवठादारांची बिले यांची तुलना करतो. नोंदी नसतील तर तुलना करण्यासारखे काही नाही.",
            ),
          },
        ],
        meaning: t(
          "As soon as you add one sale or one expense, FinSight will calculate your first score.",
          "जैसे ही आप एक बिक्री या एक खर्च जोड़ेंगे, FinSight आपका पहला स्कोर निकाल देगा।",
          "तुम्ही एक विक्री किंवा एक खर्च जोडताच FinSight तुमचा पहिला स्कोअर काढेल.",
        ),
        next: [
          t(
            "Add your first sale or expense.",
            "अपनी पहली बिक्री या खर्च जोड़ें।",
            "तुमची पहिली विक्री किंवा खर्च जोडा.",
          ),
        ],
        voice: t(
          "You do not have a health score yet. Please add one sale or one expense, and I will calculate it for you.",
          "आपका हेल्थ स्कोर अभी नहीं बना है। कृपया एक बिक्री या एक खर्च जोड़ें, फिर मैं इसे निकाल दूँगा।",
          "तुमचा आरोग्य स्कोअर अजून तयार नाही. कृपया एक विक्री किंवा एक खर्च जोडा, मग मी तो काढून देईन.",
        ),
      };
    }

    const rev = f.revenue;
    const exp = f.expenseTotal;
    const net = f.netCashFlow;
    const cash = f.currentCash;
    const ratio = cash / Math.max(f.payables, 1);
    const spendPct = rev > 0 ? (exp / rev) * 100 : 0;
    const overPct =
      f.receivables > 0 ? (f.overdueReceivableAmount / f.receivables) * 100 : 0;
    const nb = data.budgets.length;

    const detail: Record<string, string> = {
      cashFlow: t(
        `You earned ${M(rev)} and spent ${M(exp)}, so ${net >= 0 ? `you kept ${M(net)}` : `you are short by ${M(-net)}`}. A score above 50 means you keep more than you spend.`,
        `आपने ${M(rev)} कमाए और ${M(exp)} खर्च किए, इसलिए ${net >= 0 ? `${M(net)} बचे` : `${M(-net)} की कमी है`}। 50 से ऊपर का स्कोर यानी कमाई खर्च से ज़्यादा है।`,
        `तुम्ही ${M(rev)} कमावले आणि ${M(exp)} खर्च केले, म्हणून ${net >= 0 ? `${M(net)} शिल्लक राहिले` : `${M(-net)} ची तूट आहे`}. 50 पेक्षा जास्त स्कोअर म्हणजे कमाई खर्चापेक्षा जास्त.`,
      ),
      liquidity:
        f.payables > 0
          ? t(
              `You hold ${M(cash)} in cash against ${M(f.payables)} of unpaid supplier bills. That is ${ratio.toFixed(1)} times your bills. Two times or more is comfortable.`,
              `आपके पास ${M(cash)} नकदी है और सप्लायर के ${M(f.payables)} के बिल बाकी हैं। यानी बिलों का ${ratio.toFixed(1)} गुना। दो गुना या ज़्यादा हो तो आराम रहता है।`,
              `तुमच्याकडे ${M(cash)} रोख आहे आणि पुरवठादारांची ${M(f.payables)} ची बिले बाकी आहेत. म्हणजे बिलांच्या ${ratio.toFixed(1)} पट. दुप्पट किंवा जास्त असेल तर निश्चिंत राहता येते.`,
            )
          : t(
              `You hold ${M(cash)} in cash and have no unpaid supplier bills.`,
              `आपके पास ${M(cash)} नकदी है और सप्लायर का कोई बिल बाकी नहीं है।`,
              `तुमच्याकडे ${M(cash)} रोख आहे आणि पुरवठादारांचे कोणतेही बिल बाकी नाही.`,
            ),
      expenseControl:
        rev > 0
          ? t(
              `Out of every ₹100 you earn, about ₹${Math.round(spendPct)} goes to expenses. The lower this is, the more profit you keep.`,
              `हर ₹100 की कमाई में से लगभग ₹${Math.round(spendPct)} खर्च में चले जाते हैं। यह जितना कम, मुनाफ़ा उतना ज़्यादा।`,
              `प्रत्येक ₹100 कमाईपैकी सुमारे ₹${Math.round(spendPct)} खर्चात जातात. हे जितके कमी, नफा तितका जास्त.`,
            )
          : t(
              "No sales are recorded yet, so FinSight cannot judge your spending properly.",
              "अभी कोई बिक्री दर्ज नहीं है, इसलिए FinSight खर्च को ठीक से परख नहीं सकता।",
              "अजून विक्री नोंदलेली नाही, म्हणून FinSight खर्चाचे नीट मूल्यमापन करू शकत नाही.",
            ),
      receivables:
        f.receivables === 0
          ? t(
              "No customer payments are pending, so this gets full marks.",
              "ग्राहकों का कोई भुगतान बाकी नहीं है, इसलिए पूरे अंक मिले।",
              "ग्राहकांचे कोणतेही पेमेंट बाकी नाही, म्हणून पूर्ण गुण मिळाले.",
            )
          : t(
              `Customers owe you ${M(f.receivables)}, and ${M(f.overdueReceivableAmount)} of it (${pct(overPct)}) is overdue. Overdue money is your cash stuck outside the business.`,
              `ग्राहकों पर आपके ${M(f.receivables)} बाकी हैं, जिनमें से ${M(f.overdueReceivableAmount)} (${pct(overPct)}) देर से हैं। देर वाला पैसा आपकी नकदी है जो व्यवसाय के बाहर अटकी है।`,
              `ग्राहकांकडे तुमचे ${M(f.receivables)} बाकी आहेत, त्यापैकी ${M(f.overdueReceivableAmount)} (${pct(overPct)}) उशिरा आहेत. उशीर झालेले पैसे म्हणजे व्यवसायाबाहेर अडकलेली तुमची रोख.`,
            ),
      payables:
        f.payables > 0
          ? t(
              `Your unpaid supplier bills are ${M(f.payables)} compared with ${M(cash)} of cash. The smaller the bills are next to your cash, the safer you are.`,
              `सप्लायर के बिल ${M(f.payables)} हैं, जबकि नकदी ${M(cash)} है। नकदी के मुकाबले बिल जितने छोटे, आप उतने सुरक्षित।`,
              `पुरवठादारांची बिले ${M(f.payables)} आहेत, तर रोख ${M(cash)} आहे. रोखीच्या तुलनेत बिले जितकी लहान, तुम्ही तितके सुरक्षित.`,
            )
          : t(
              "You have no pending supplier bills, so this is strong.",
              "सप्लायर का कोई बिल बाकी नहीं है, इसलिए यह मज़बूत है।",
              "पुरवठादारांचे कोणतेही बिल बाकी नाही, म्हणून हे मजबूत आहे.",
            ),
      budgetPerformance:
        nb === 0
          ? t(
              "You have not set any budgets, so FinSight uses a neutral 70. Setting budgets makes this score more accurate.",
              "आपने कोई बजट तय नहीं किया है, इसलिए FinSight तटस्थ 70 मानता है। बजट तय करने से यह स्कोर ज़्यादा सटीक होगा।",
              "तुम्ही कोणतेही बजेट ठरवलेले नाही, म्हणून FinSight तटस्थ 70 धरतो. बजेट ठरवल्यास हा स्कोअर अधिक अचूक होईल.",
            )
          : t(
              `You set ${nb} budget${nb > 1 ? "s" : ""}. This score drops whenever a category spends more than its budget.`,
              `आपने ${nb} बजट तय किए हैं। जब कोई श्रेणी अपने बजट से ज़्यादा खर्च करती है, यह स्कोर घटता है।`,
              `तुम्ही ${nb} बजेट ठरवले आहेत. एखादी श्रेणी बजेटपेक्षा जास्त खर्च करते तेव्हा हा स्कोअर कमी होतो.`,
            ),
    };

    const sorted = [...f.healthBreakdown].sort((a, b) => a.score - b.score);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];
    const label = (k: string) => FACTOR_LABEL[k]?.[lang] ?? k;
    const tone: WhyTone = f.score >= 70 ? "good" : f.score >= 45 ? "watch" : "risk";

    return {
      title,
      tone,
      headline: t(
        `Your score is ${f.score} out of 100. It is the average of six checks, and "${label(weakest.key)}" (${weakest.score}) is pulling it down the most.`,
        `आपका स्कोर 100 में से ${f.score} है। यह छह जाँचों का औसत है, और "${label(weakest.key)}" (${weakest.score}) इसे सबसे ज़्यादा नीचे खींच रहा है।`,
        `तुमचा स्कोअर 100 पैकी ${f.score} आहे. हा सहा तपासण्यांची सरासरी आहे आणि "${label(weakest.key)}" (${weakest.score}) तो सर्वात जास्त खाली ओढत आहे.`,
      ),
      because: f.healthBreakdown.map((h) => ({
        label: label(h.key),
        value: `${h.score}/100`,
        detail: detail[h.key] ?? "",
      })),
      meaning: t(
        `Above 70 means your business is comfortable, 45 to 70 means keep an eye on it, and below 45 means act soon. Your strongest area is "${label(strongest.key)}" (${strongest.score}).`,
        `70 से ऊपर यानी व्यवसाय आराम में है, 45 से 70 यानी नज़र रखें, और 45 से नीचे यानी जल्दी कदम उठाएँ। आपका सबसे मज़बूत क्षेत्र "${label(strongest.key)}" (${strongest.score}) है।`,
        `70 पेक्षा जास्त म्हणजे व्यवसाय निश्चिंत आहे, 45 ते 70 म्हणजे लक्ष ठेवा, आणि 45 पेक्षा कमी म्हणजे लवकर पावले उचला. तुमचे सर्वात मजबूत क्षेत्र "${label(strongest.key)}" (${strongest.score}) आहे.`,
      ),
      next: [
        FACTOR_TIP[weakest.key]?.[lang] ?? "",
        ...(sorted[1] && sorted[1].score < 70
          ? [FACTOR_TIP[sorted[1].key]?.[lang] ?? ""]
          : []),
      ].filter(Boolean),
      voice: t(
        `Your financial health score is ${f.score} out of 100. This score is the average of six simple checks: cash flow, cash in hand, spending control, customer payments, supplier bills, and budgets. Your strongest area is ${label(strongest.key)}. Your weakest area is ${label(weakest.key)}. To improve your score, start there. ${FACTOR_TIP[weakest.key]?.[lang] ?? ""}`,
        `आपका फाइनेंशियल हेल्थ स्कोर 100 में से ${f.score} है। यह स्कोर छह आसान जाँचों का औसत है: नकदी प्रवाह, हाथ में नकदी, खर्च पर नियंत्रण, ग्राहकों से भुगतान, सप्लायर के बिल और बजट। आपका सबसे मज़बूत क्षेत्र ${label(strongest.key)} है। सबसे कमज़ोर क्षेत्र ${label(weakest.key)} है। स्कोर सुधारने के लिए वहीं से शुरू करें। ${FACTOR_TIP[weakest.key]?.[lang] ?? ""}`,
        `तुमचा आर्थिक आरोग्य स्कोअर 100 पैकी ${f.score} आहे. हा स्कोअर सहा सोप्या तपासण्यांची सरासरी आहे: रोख प्रवाह, हातातील रोख, खर्चावर नियंत्रण, ग्राहकांकडून पेमेंट, पुरवठादारांची बिले आणि बजेट. तुमचे सर्वात मजबूत क्षेत्र ${label(strongest.key)} आहे. सर्वात कमकुवत क्षेत्र ${label(weakest.key)} आहे. स्कोअर सुधारण्यासाठी तिथूनच सुरुवात करा. ${FACTOR_TIP[weakest.key]?.[lang] ?? ""}`,
      ),
    };
  };
  return { en: mk("en"), hi: mk("hi"), mr: mk("mr") };
}

/* ------------------------------------------------------------------ */
/* 2. Alerts & recommendations                                         */
/* ------------------------------------------------------------------ */

export function whyAlert(
  action: ActionItem,
  f: Fin,
  data: BusinessBootstrap,
): WhyContent {
  const mk = (lang: Lang): WhyBody => {
    const t = pick(lang);
    const M = (n: number) => money(n, lang);
    const S = (n: number) => say(n, lang);
    const idx = Number(action.id.split("-").pop());
    const health = (key: string) =>
      f.healthBreakdown.find((h) => h.key === key)?.score ?? 0;
    const toneOf: WhyTone =
      action.tone === "red" ? "risk" : action.tone === "green" ? "good" : "watch";

    /* ---- Overdue receivables ---- */
    if (action.kind === "collections") {
      const over = f.overdueReceivableAmount;
      const count = data.receivables.filter((r) => /overdue/i.test(r.status)).length;
      const share = f.receivables > 0 ? (over / f.receivables) * 100 : 0;
      return {
        title: action.title,
        tone: "risk",
        headline: t(
          `${M(over)} from ${count} invoice${count > 1 ? "s" : ""} is overdue. That is ${pct(share)} of all the money your customers owe you.`,
          `${count} बिल के ${M(over)} देर से हैं। यह ग्राहकों पर आपके कुल बकाया का ${pct(share)} है।`,
          `${count} बिलांचे ${M(over)} उशिरा आहेत. हे ग्राहकांकडील तुमच्या एकूण थकबाकीच्या ${pct(share)} आहे.`,
        ),
        because: [
          {
            label: t("What triggered this alert", "यह अलर्ट क्यों आया", "हा अलर्ट का आला"),
            value: M(over),
            detail: t(
              "FinSight found invoices whose due date has passed and that are not yet marked as paid.",
              "FinSight को ऐसे बिल मिले जिनकी देय तारीख निकल चुकी है और जो अभी 'चुकाया गया' नहीं हैं।",
              "FinSight ला असे बिल सापडले ज्यांची देय तारीख उलटून गेली आहे आणि जे अजून 'भरले' म्हणून नोंदलेले नाहीत.",
            ),
          },
          {
            label: t("Why late money hurts", "देर से आया पैसा क्यों नुकसान करता है", "उशिरा येणारे पैसे का त्रास देतात"),
            detail: t(
              "You already did the work and delivered the goods, but the cash is not in your bank. Rent, wages and suppliers still need to be paid on time.",
              "आपने काम और माल दे दिया, पर पैसा बैंक में नहीं आया। किराया, मज़दूरी और सप्लायर को समय पर ही देना पड़ता है।",
              "तुम्ही काम आणि माल दिला, पण पैसे बँकेत आले नाहीत. भाडे, मजुरी आणि पुरवठादारांना वेळेवरच द्यावे लागतात.",
            ),
          },
          {
            label: t("Effect on your health score", "हेल्थ स्कोर पर असर", "आरोग्य स्कोअरवर परिणाम"),
            value: `${health("receivables")}/100`,
            detail: t(
              "Your Customer payments score falls as the overdue share grows.",
              "बकाया का देर वाला हिस्सा बढ़ने पर 'ग्राहकों से भुगतान' का स्कोर गिरता है।",
              "थकीत हिस्सा वाढला की 'ग्राहकांकडून पेमेंट' चा स्कोअर घसरतो.",
            ),
          },
        ],
        meaning: t(
          "Collecting this money is the fastest way to improve your cash without selling anything new.",
          "यह पैसा वसूलना बिना कुछ नया बेचे नकदी सुधारने का सबसे तेज़ तरीका है।",
          "हे पैसे वसूल करणे म्हणजे काही नवीन न विकता रोख सुधारण्याचा सर्वात जलद मार्ग.",
        ),
        next: [
          t(
            "Call or WhatsApp the customers with the oldest and biggest invoices first.",
            "सबसे पुराने और बड़े बिल वाले ग्राहकों को सबसे पहले फ़ोन या WhatsApp करें।",
            "सर्वात जुन्या आणि मोठ्या बिलांच्या ग्राहकांना आधी फोन किंवा WhatsApp करा.",
          ),
          t(
            "Offer a small early-payment discount or a part-payment plan.",
            "जल्दी भुगतान पर छोटी छूट या किस्तों में भुगतान का विकल्प दें।",
            "लवकर पेमेंटसाठी थोडी सवलत किंवा हप्त्यांमध्ये पेमेंटचा पर्याय द्या.",
          ),
          t(
            "Mark the invoice as paid in Receivables once money arrives, so this alert clears.",
            "पैसा आते ही Receivables में बिल को 'चुकाया' करें, ताकि यह अलर्ट हट जाए।",
            "पैसे येताच Receivables मध्ये बिल 'भरले' करा, म्हणजे हा अलर्ट जाईल.",
          ),
        ],
        voice: t(
          `${S(over)} is overdue from ${count} customer invoice${count > 1 ? "s" : ""}. That means customers have not paid you on time. This is your own money, but it is stuck outside your business. Please call the customer with the oldest bill first. Once they pay, mark the invoice as paid, and this alert will go away.`,
          `${count} ग्राहक बिल के ${S(over)} देर से हैं। यानी ग्राहकों ने समय पर पैसे नहीं दिए। यह आपका अपना पैसा है, लेकिन व्यवसाय के बाहर अटका हुआ है। कृपया सबसे पुराने बिल वाले ग्राहक को पहले फ़ोन करें। पैसे मिलते ही बिल को चुकाया दर्ज करें, यह अलर्ट हट जाएगा।`,
          `${count} ग्राहक बिलांचे ${S(over)} उशिरा आहेत. म्हणजे ग्राहकांनी वेळेवर पैसे दिले नाहीत. हे तुमचेच पैसे आहेत, पण व्यवसायाबाहेर अडकले आहेत. कृपया सर्वात जुन्या बिलाच्या ग्राहकाला आधी फोन करा. पैसे मिळताच बिल भरले म्हणून नोंदवा, हा अलर्ट निघून जाईल.`,
        ),
      };
    }

    /* ---- Category cost anomaly ---- */
    if (action.kind === "anomaly") {
      const a = f.anomalies[idx];
      if (a) {
        const diff = a.currentAmount - a.averageAmount;
        return {
          title: action.title,
          tone: "watch",
          headline: t(
            `${a.category} cost ${Math.round(a.changePct)}% more this month than your usual monthly average.`,
            `${a.category} का खर्च इस महीने आपके सामान्य मासिक औसत से ${Math.round(a.changePct)}% ज़्यादा रहा।`,
            `${a.category} चा खर्च या महिन्यात तुमच्या नेहमीच्या मासिक सरासरीपेक्षा ${Math.round(a.changePct)}% जास्त झाला.`,
          ),
          because: [
            {
              label: t("This month", "इस महीने", "या महिन्यात"),
              value: M(a.currentAmount),
              detail: t(
                `Total spent on ${a.category} in your latest month.`,
                `आपके ताज़ा महीने में ${a.category} पर कुल खर्च।`,
                `तुमच्या ताज्या महिन्यात ${a.category} वर झालेला एकूण खर्च.`,
              ),
            },
            {
              label: t("Usual month", "सामान्य महीना", "नेहमीचा महिना"),
              value: M(a.averageAmount),
              detail: t(
                "The average of all your earlier months for this category.",
                "इस श्रेणी के पिछले सभी महीनों का औसत।",
                "या श्रेणीच्या मागील सर्व महिन्यांची सरासरी.",
              ),
            },
            {
              label: t("Extra spent", "ज़्यादा खर्च", "जास्तीचा खर्च"),
              value: M(diff),
              detail: t(
                "FinSight raises this alert whenever a category is 15% or more above its usual level.",
                "जब कोई श्रेणी अपने सामान्य स्तर से 15% या ज़्यादा ऊपर जाती है, तब FinSight यह अलर्ट देता है।",
                "एखादी श्रेणी तिच्या नेहमीच्या पातळीपेक्षा 15% किंवा जास्त वर गेली की FinSight हा अलर्ट देतो.",
              ),
            },
          ],
          meaning: t(
            "A jump can be harmless (a bulk purchase or a one-time job) or a warning (a price rise or a billing mistake). Only you can tell which, so it is worth a quick look.",
            "यह उछाल बेहानिकारक हो सकता है (थोक खरीद या एक बार का काम) या चेतावनी (दाम बढ़ना या बिल में गलती)। यह आप ही बता सकते हैं, इसलिए एक बार देख लेना ठीक रहेगा।",
            "ही वाढ निरुपद्रवी असू शकते (मोठी खरेदी किंवा एकदाचे काम) किंवा इशारा (भाववाढ किंवा बिलातील चूक). हे तुम्हीच सांगू शकता, म्हणून एकदा पाहून घेणे योग्य.",
          ),
          next: [
            t(
              `Open Transactions and filter by ${a.category} to see what was bought.`,
              `Transactions खोलें और ${a.category} से फ़िल्टर करके देखें कि क्या खरीदा गया।`,
              `Transactions उघडा आणि ${a.category} नुसार फिल्टर करून काय खरेदी झाले ते पहा.`,
            ),
            t(
              "Compare the rate with what your vendor charged last month.",
              "वेंडर ने पिछले महीने जो दाम लिया था, उससे तुलना करें।",
              "वेंडरने गेल्या महिन्यात लावलेल्या दराशी तुलना करा.",
            ),
            t(
              "If it was a one-time cost, simply mark the alert as reviewed.",
              "अगर यह एक बार का खर्च था, तो अलर्ट को 'समीक्षित' कर दें।",
              "हा एकदाचा खर्च असेल तर अलर्ट 'पाहिला' म्हणून नोंदवा.",
            ),
          ],
          voice: t(
            `Your ${a.category} spending is higher than normal. This month you spent ${S(a.currentAmount)}. Your usual month is ${S(a.averageAmount)}. That is ${sayPct(a.changePct, lang)} more. It may be a big one-time purchase, or a price increase. Please check the bills in Transactions to find out.`,
            `आपका ${a.category} का खर्च सामान्य से ज़्यादा है। इस महीने आपने ${S(a.currentAmount)} खर्च किए। आपका सामान्य महीना ${S(a.averageAmount)} का होता है। यानी ${sayPct(a.changePct, lang)} ज़्यादा। यह बड़ी एक बार की खरीद हो सकती है, या दाम बढ़ना। कृपया Transactions में बिल देखकर पता करें।`,
            `तुमचा ${a.category} चा खर्च नेहमीपेक्षा जास्त आहे. या महिन्यात तुम्ही ${S(a.currentAmount)} खर्च केले. तुमचा नेहमीचा महिना साधारण ${S(a.averageAmount)} इतका असतो. म्हणजे ${sayPct(a.changePct, lang)} जास्त. ही मोठी एकदाची खरेदी असू शकते, किंवा भाववाढ. कृपया Transactions मधील बिले पाहून खात्री करा.`,
          ),
        };
      }
    }

    /* ---- Supplier payments due soon ---- */
    if (action.kind === "payables") {
      const asOf = latestDate(data);
      const due = data.payables.filter(
        (p) =>
          !isSettled(p.status) &&
          daysBetween(asOf, p.dueDate) <= 14 &&
          daysBetween(asOf, p.dueDate) >= 0,
      );
      const sum = due.reduce((s, p) => s + p.amount, 0);
      const left = f.currentCash - sum;
      const nearest = due
        .map((p) => p.dueDate)
        .sort()[0];
      return {
        title: action.title,
        tone: left < 0 ? "risk" : "watch",
        headline: t(
          `${M(sum)} across ${due.length} supplier bill${due.length > 1 ? "s" : ""} must be paid within the next 14 days.`,
          `अगले 14 दिनों में ${due.length} सप्लायर बिल के ${M(sum)} चुकाने हैं।`,
          `पुढील 14 दिवसांत ${due.length} पुरवठादार बिलांचे ${M(sum)} भरायचे आहेत.`,
        ),
        because: [
          {
            label: t("Bills coming up", "आने वाले बिल", "येणारी बिले"),
            value: M(sum),
            detail: t(
              `The nearest due date is ${nearest ?? "soon"}. FinSight looks 14 days ahead from your latest record.`,
              `सबसे नज़दीकी देय तारीख ${nearest ?? "जल्द"} है। FinSight आपके ताज़ा रिकॉर्ड से 14 दिन आगे तक देखता है।`,
              `सर्वात जवळची देय तारीख ${nearest ?? "लवकरच"} आहे. FinSight तुमच्या ताज्या नोंदीपासून 14 दिवस पुढे पाहतो.`,
            ),
          },
          {
            label: t("Cash you have now", "अभी आपके पास नकदी", "आत्ता तुमच्याकडे रोख"),
            value: M(f.currentCash),
            detail: t(
              "Opening cash plus everything earned minus everything spent so far.",
              "शुरुआती नकदी, साथ में अब तक की कमाई, और अब तक का खर्च घटाकर।",
              "सुरुवातीची रोख, सोबत आतापर्यंतची कमाई, आणि आतापर्यंतचा खर्च वजा करून.",
            ),
          },
          {
            label: t("Cash left after paying", "भुगतान के बाद बची नकदी", "पेमेंटनंतर उरलेली रोख"),
            value: M(left),
            detail:
              left < 0
                ? t(
                    "You do not have enough cash to pay all of these on time unless customers pay you first.",
                    "जब तक ग्राहक पहले भुगतान न करें, आपके पास ये सब समय पर चुकाने के लिए पर्याप्त नकदी नहीं है।",
                    "ग्राहकांनी आधी पेमेंट केल्याशिवाय हे सर्व वेळेवर भरण्याइतकी रोख तुमच्याकडे नाही.",
                  )
                : t(
                    "You can cover these bills, but this is the cash buffer that will remain.",
                    "आप ये बिल चुका सकते हैं, पर इसके बाद इतनी ही नकदी बचेगी।",
                    "तुम्ही ही बिले भरू शकता, पण त्यानंतर इतकीच रोख उरेल.",
                  ),
          },
        ],
        meaning: t(
          "Paying suppliers late can damage trust and your credit terms, so it is better to plan now than to scramble on the due date.",
          "सप्लायर को देर से भुगतान करने से भरोसा और उधार की शर्तें बिगड़ सकती हैं, इसलिए आखिरी दिन भागदौड़ करने से बेहतर है कि अभी योजना बना लें।",
          "पुरवठादारांना उशिरा पेमेंट केल्याने विश्वास आणि उधारीच्या अटी बिघडू शकतात, म्हणून शेवटच्या दिवशी धावपळ करण्यापेक्षा आत्ताच नियोजन करणे चांगले.",
        ),
        next: [
          t(
            "Pay the most important suppliers first (raw material, transport).",
            "सबसे ज़रूरी सप्लायर (कच्चा माल, ढुलाई) को पहले भुगतान करें।",
            "सर्वात महत्त्वाच्या पुरवठादारांना (कच्चा माल, वाहतूक) आधी पेमेंट करा.",
          ),
          t(
            "Collect customer dues before these dates arrive.",
            "इन तारीखों से पहले ग्राहकों का बकाया वसूल करें।",
            "या तारखांपूर्वी ग्राहकांची थकबाकी वसूल करा.",
          ),
          t(
            "Ask a supplier for a few extra days if cash is tight. Do it before the due date.",
            "नकदी कम हो तो सप्लायर से कुछ दिन और माँगें। यह देय तारीख से पहले करें।",
            "रोख कमी असेल तर पुरवठादाराकडे काही दिवस जास्त मागा. हे देय तारखेपूर्वी करा.",
          ),
        ],
        voice: t(
          `You have ${due.length} supplier bill${due.length > 1 ? "s" : ""} to pay in the next 14 days. The total is ${S(sum)}. You have ${S(f.currentCash)} in cash. After paying, ${left >= 0 ? `you will have ${S(left)} left` : `you will be short by ${S(-left)}`}. Please plan which supplier to pay first, and try to collect customer dues before the due dates.`,
          `अगले 14 दिनों में आपको ${due.length} सप्लायर बिल चुकाने हैं। कुल रकम ${S(sum)} है। आपके पास ${S(f.currentCash)} नकदी है। भुगतान के बाद ${left >= 0 ? `${S(left)} बचेंगे` : `${S(-left)} की कमी रहेगी`}। कृपया तय करें कि किस सप्लायर को पहले देना है, और देय तारीख से पहले ग्राहकों का बकाया वसूलने की कोशिश करें।`,
          `पुढील 14 दिवसांत तुम्हाला ${due.length} पुरवठादार बिले भरायची आहेत. एकूण रक्कम ${S(sum)} आहे. तुमच्याकडे ${S(f.currentCash)} रोख आहे. पेमेंटनंतर ${left >= 0 ? `${S(left)} उरतील` : `${S(-left)} ची तूट राहील`}. कृपया कोणत्या पुरवठादाराला आधी द्यायचे ते ठरवा, आणि देय तारखेपूर्वी ग्राहकांची थकबाकी वसूल करण्याचा प्रयत्न करा.`,
        ),
      };
    }

    /* ---- Budget overspend ---- */
    if (action.kind === "budget") {
      const b = f.budgetOverspend[idx];
      if (b) {
        return {
          title: action.title,
          tone: "watch",
          headline: t(
            `You planned to spend ${M(b.budget)} on ${b.category} but have already spent ${M(b.actual)}, which is ${Math.round(b.overPct)}% over.`,
            `आपने ${b.category} पर ${M(b.budget)} खर्च करने की योजना बनाई थी, पर ${M(b.actual)} खर्च हो चुके हैं, यानी ${Math.round(b.overPct)}% ज़्यादा।`,
            `तुम्ही ${b.category} वर ${M(b.budget)} खर्च करण्याचे ठरवले होते, पण ${M(b.actual)} खर्च झाले आहेत, म्हणजे ${Math.round(b.overPct)}% जास्त.`,
          ),
          because: [
            {
              label: t("Your budget", "आपका बजट", "तुमचे बजेट"),
              value: M(b.budget),
              detail: t(
                "The limit you set for this category.",
                "इस श्रेणी के लिए आपका तय किया हुआ सीमा-मूल्य।",
                "या श्रेणीसाठी तुम्ही ठरवलेली मर्यादा.",
              ),
            },
            {
              label: t("Actually spent", "असल में खर्च", "प्रत्यक्ष खर्च"),
              value: M(b.actual),
              detail: t(
                "The total of all expense records in this category.",
                "इस श्रेणी के सभी खर्च रिकॉर्ड का कुल योग।",
                "या श्रेणीतील सर्व खर्च नोंदींची बेरीज.",
              ),
            },
            {
              label: t("Over by", "कितना ज़्यादा", "किती जास्त"),
              value: M(b.actual - b.budget),
              detail: t(
                "FinSight alerts you when spending goes more than 5% over budget.",
                "खर्च बजट से 5% से ज़्यादा होने पर FinSight आपको अलर्ट करता है।",
                "खर्च बजेटपेक्षा 5% पेक्षा जास्त झाला की FinSight तुम्हाला अलर्ट करतो.",
              ),
            },
          ],
          meaning: t(
            "Going over budget quietly eats into your profit. Catching it early lets you slow down before the month ends.",
            "बजट से ज़्यादा खर्च चुपचाप आपका मुनाफ़ा खा जाता है। जल्दी पकड़ लें तो महीना खत्म होने से पहले रफ़्तार धीमी की जा सकती है।",
            "बजेटपेक्षा जास्त खर्च शांतपणे तुमचा नफा खातो. लवकर लक्षात आले तर महिना संपण्यापूर्वी वेग कमी करता येतो.",
          ),
          next: [
            t(
              "Pause non-urgent purchases in this category.",
              "इस श्रेणी की गैर-ज़रूरी खरीद रोक दें।",
              "या श्रेणीतील गरज नसलेली खरेदी थांबवा.",
            ),
            t(
              "If the higher cost is permanent, raise the budget so your alerts stay meaningful.",
              "अगर बढ़ा हुआ खर्च स्थायी है, तो बजट बढ़ा दें ताकि आपके अलर्ट सार्थक रहें।",
              "वाढलेला खर्च कायमचा असेल तर बजेट वाढवा, म्हणजे तुमचे अलर्ट अर्थपूर्ण राहतील.",
            ),
          ],
          voice: t(
            `Your ${b.category} spending has crossed your budget. You planned ${S(b.budget)}, but you have spent ${S(b.actual)}. That is ${sayPct(b.overPct, lang)} over. Try to pause extra purchases in this category for now.`,
            `आपका ${b.category} का खर्च बजट से ऊपर चला गया है। आपने ${S(b.budget)} की योजना बनाई थी, पर ${S(b.actual)} खर्च हो गए। यानी ${sayPct(b.overPct, lang)} ज़्यादा। फ़िलहाल इस श्रेणी की अतिरिक्त खरीद रोकने की कोशिश करें।`,
            `तुमचा ${b.category} चा खर्च बजेटपेक्षा वर गेला आहे. तुम्ही ${S(b.budget)} खर्च करण्याचे नियोजन केले होते, पण ${S(b.actual)} खर्च झाले. म्हणजे ${sayPct(b.overPct, lang)} जास्त. सध्या या श्रेणीतील अतिरिक्त खरेदी थांबवण्याचा प्रयत्न करा.`,
          ),
        };
      }
    }

    /* ---- Baseline / everything else ---- */
    const net = f.netCashFlow;
    return {
      title: action.title,
      tone: toneOf,
      headline:
        net >= 0
          ? t(
              "No urgent problem was found, and you are earning more than you spend.",
              "कोई तुरंत की समस्या नहीं मिली, और आपकी कमाई खर्च से ज़्यादा है।",
              "कोणतीही तातडीची समस्या सापडली नाही, आणि तुमची कमाई खर्चापेक्षा जास्त आहे.",
            )
          : t(
              "No single alert fired, but your expenses are currently higher than your revenue.",
              "कोई एक अलर्ट नहीं आया, पर अभी आपका खर्च आपकी कमाई से ज़्यादा है।",
              "एकही अलर्ट आला नाही, पण सध्या तुमचा खर्च तुमच्या कमाईपेक्षा जास्त आहे.",
            ),
      because: [
        {
          label: t("Revenue", "कमाई", "कमाई"),
          value: M(f.revenue),
          detail: t("Everything you have recorded as sales.", "आपने जो भी बिक्री दर्ज की है उसका योग।", "तुम्ही नोंदवलेल्या सर्व विक्रीची बेरीज."),
        },
        {
          label: t("Expenses", "खर्च", "खर्च"),
          value: M(f.expenseTotal),
          detail: t("Everything you have recorded as spending.", "आपने जो भी खर्च दर्ज किया है उसका योग।", "तुम्ही नोंदवलेल्या सर्व खर्चाची बेरीज."),
        },
        {
          label: t("Net cash flow", "शुद्ध नकदी प्रवाह", "निव्वळ रोख प्रवाह"),
          value: M(net),
          detail: t(
            "Revenue minus expenses. FinSight raises alerts only when something needs action.",
            "कमाई में से खर्च घटाने पर। FinSight तभी अलर्ट देता है जब किसी चीज़ पर कदम उठाना ज़रूरी हो।",
            "कमाईतून खर्च वजा केल्यावर. एखाद्या गोष्टीवर कृती आवश्यक असेल तेव्हाच FinSight अलर्ट देतो.",
          ),
        },
      ],
      meaning: t(
        "Keep adding records regularly. The more complete your data, the sharper and earlier these alerts become.",
        "नियमित रूप से रिकॉर्ड जोड़ते रहें। आपका डेटा जितना पूरा होगा, अलर्ट उतने सटीक और जल्दी मिलेंगे।",
        "नियमितपणे नोंदी जोडत रहा. तुमचा डेटा जितका पूर्ण, अलर्ट तितके अचूक आणि लवकर मिळतील.",
      ),
      next: [
        t(
          "Add this week's sales and expenses.",
          "इस हफ़्ते की बिक्री और खर्च जोड़ें।",
          "या आठवड्याची विक्री आणि खर्च जोडा.",
        ),
      ],
      voice: t(
        `There is no urgent problem right now. You earned ${S(f.revenue)} and spent ${S(f.expenseTotal)}. ${net >= 0 ? `You kept ${S(net)}.` : `You are short by ${S(-net)}.`} Keep adding your records so I can warn you early.`,
        `अभी कोई तुरंत की समस्या नहीं है। आपने ${S(f.revenue)} कमाए और ${S(f.expenseTotal)} खर्च किए। ${net >= 0 ? `${S(net)} बचे।` : `${S(-net)} की कमी है।`} रिकॉर्ड जोड़ते रहें ताकि मैं आपको पहले से चेतावनी दे सकूँ।`,
        `सध्या कोणतीही तातडीची समस्या नाही. तुम्ही ${S(f.revenue)} कमावले आणि ${S(f.expenseTotal)} खर्च केले. ${net >= 0 ? `${S(net)} शिल्लक राहिले.` : `${S(-net)} ची तूट आहे.`} नोंदी जोडत रहा, म्हणजे मी तुम्हाला आधीच सावध करू शकेन.`,
      ),
    };
  };
  return { en: mk("en"), hi: mk("hi"), mr: mk("mr") };
}

/* ------------------------------------------------------------------ */
/* 3. Cash forecast                                                    */
/* ------------------------------------------------------------------ */

export function whyForecast(f: Fin, days: number): WhyContent {
  const p = f.forecast.find((x) => x.days === days) ?? f.forecast[f.forecast.length - 1];
  const mk = (lang: Lang): WhyBody => {
    const t = pick(lang);
    const M = (n: number) => money(n, lang);
    const S = (n: number) => say(n, lang);
    const dropped = p.balance < f.currentCash;
    const tone: WhyTone = p.balance < 0 ? "risk" : dropped ? "watch" : "good";
    const months = days / 30;
    return {
      title: t(
        `Why the ${days}-day forecast looks like this`,
        `${days} दिन का पूर्वानुमान ऐसा क्यों दिख रहा है`,
        `${days} दिवसांचा अंदाज असा का दिसतो`,
      ),
      tone,
      headline: t(
        `In ${days} days you are expected to have about ${M(p.balance)}, which is ${dropped ? "less" : "more"} than the ${M(f.currentCash)} you have today.`,
        `${days} दिनों में आपके पास लगभग ${M(p.balance)} होने का अनुमान है, जो आज के ${M(f.currentCash)} से ${dropped ? "कम" : "ज़्यादा"} है।`,
        `${days} दिवसांत तुमच्याकडे सुमारे ${M(p.balance)} असण्याचा अंदाज आहे, जे आजच्या ${M(f.currentCash)} पेक्षा ${dropped ? "कमी" : "जास्त"} आहे.`,
      ),
      because: [
        {
          label: t("1. Cash today", "1. आज की नकदी", "1. आजची रोख"),
          value: M(f.currentCash),
          detail: t(
            "Your opening cash plus all revenue minus all expenses you have recorded.",
            "आपकी शुरुआती नकदी, साथ में दर्ज सारी कमाई, और दर्ज सारा खर्च घटाकर।",
            "तुमची सुरुवातीची रोख, सोबत नोंदवलेली सर्व कमाई, आणि नोंदवलेला सर्व खर्च वजा करून.",
          ),
        },
        {
          label: t("2. Expected new sales (+)", "2. अपेक्षित नई बिक्री (+)", "2. अपेक्षित नवीन विक्री (+)"),
          value: M(p.baseRevenue),
          detail: t(
            `Your average monthly sales over the last 3 months, for ${months} month${months > 1 ? "s" : ""}.`,
            `पिछले 3 महीनों की औसत मासिक बिक्री, ${months} महीने के लिए।`,
            `गेल्या 3 महिन्यांची सरासरी मासिक विक्री, ${months} महिन्यांसाठी.`,
          ),
        },
        {
          label: t("3. Customer dues arriving (+)", "3. ग्राहकों से आने वाला बकाया (+)", "3. ग्राहकांकडून येणारी थकबाकी (+)"),
          value: M(p.receivablesDue),
          detail: t(
            "Unpaid customer invoices whose due date falls inside this period.",
            "बिना चुकाए ग्राहक बिल जिनकी देय तारीख इस अवधि में आती है।",
            "न भरलेली ग्राहक बिले ज्यांची देय तारीख या कालावधीत येते.",
          ),
        },
        {
          label: t("4. Usual spending (−)", "4. सामान्य खर्च (−)", "4. नेहमीचा खर्च (−)"),
          value: M(p.baseExpense),
          detail: t(
            "Your average monthly spending over the last 3 months, for this period.",
            "पिछले 3 महीनों का औसत मासिक खर्च, इस अवधि के लिए।",
            "गेल्या 3 महिन्यांचा सरासरी मासिक खर्च, या कालावधीसाठी.",
          ),
        },
        {
          label: t("5. Recurring bills (−)", "5. नियमित बिल (−)", "5. नियमित बिले (−)"),
          value: M(p.recurring),
          detail: t(
            "Rent, EMIs and other repeating costs you added in Settings.",
            "किराया, EMI और अन्य नियमित खर्च जो आपने Settings में जोड़े हैं।",
            "भाडे, EMI आणि इतर नियमित खर्च जे तुम्ही Settings मध्ये जोडले आहेत.",
          ),
        },
        {
          label: t("6. Supplier bills due (−)", "6. देय सप्लायर बिल (−)", "6. देय पुरवठादार बिले (−)"),
          value: M(p.payablesDue),
          detail: t(
            "Unpaid supplier bills whose due date falls inside this period.",
            "बिना चुकाए सप्लायर बिल जिनकी देय तारीख इस अवधि में आती है।",
            "न भरलेली पुरवठादार बिले ज्यांची देय तारीख या कालावधीत येते.",
          ),
        },
        {
          label: t("Result", "नतीजा", "निकाल"),
          value: M(p.balance),
          detail: t(
            `${M(f.currentCash)} + ${M(p.inflow)} coming in − ${M(p.outflow)} going out.`,
            `${M(f.currentCash)} + ${M(p.inflow)} आना − ${M(p.outflow)} जाना।`,
            `${M(f.currentCash)} + ${M(p.inflow)} येणे − ${M(p.outflow)} जाणे.`,
          ),
        },
      ],
      meaning: t(
        "This is an estimate based on your past habits, not a promise. If a big customer pays late, the real number will be lower. If you win a big order, it will be higher.",
        "यह आपकी पिछली आदतों पर आधारित अनुमान है, वादा नहीं। अगर कोई बड़ा ग्राहक देर से भुगतान करे तो असली रकम कम होगी। बड़ा ऑर्डर मिले तो ज़्यादा होगी।",
        "हा तुमच्या मागील सवयींवर आधारित अंदाज आहे, हमी नाही. एखाद्या मोठ्या ग्राहकाने उशिरा पेमेंट केले तर खरी रक्कम कमी असेल. मोठी ऑर्डर मिळाली तर जास्त असेल.",
      ),
      next: [
        p.balance < 0
          ? t(
              "Your cash may run out. Collect dues early and delay non-urgent supplier payments.",
              "आपकी नकदी खत्म हो सकती है। बकाया जल्दी वसूलें और गैर-ज़रूरी सप्लायर भुगतान टालें।",
              "तुमची रोख संपू शकते. थकबाकी लवकर वसूल करा आणि गरज नसलेली पुरवठादार पेमेंट्स पुढे ढकला.",
            )
          : t(
              "Use the What-if simulator to test how a price change or a cost rise would move this number.",
              "What-if सिमुलेटर से देखें कि दाम बदलने या खर्च बढ़ने पर यह रकम कैसे बदलेगी।",
              "भाव बदलले किंवा खर्च वाढला तर ही रक्कम कशी बदलेल हे What-if सिम्युलेटरमध्ये पहा.",
            ),
        t(
          "Keep recurring expenses and due dates updated so the forecast stays accurate.",
          "नियमित खर्च और देय तारीखें अपडेट रखें ताकि पूर्वानुमान सटीक रहे।",
          "नियमित खर्च आणि देय तारखा अद्ययावत ठेवा, म्हणजे अंदाज अचूक राहील.",
        ),
      ],
      voice: t(
        `This is your ${days} day cash forecast. Today you have ${S(f.currentCash)}. In the next ${days} days, about ${S(p.inflow)} should come in from sales and customer payments, and about ${S(p.outflow)} will go out for spending and bills. So you should have around ${S(p.balance)} at the end. This is an estimate. If customers pay late, it will be lower.`,
        `यह आपका ${days} दिन का नकदी पूर्वानुमान है। आज आपके पास ${S(f.currentCash)} हैं। अगले ${days} दिनों में बिक्री और ग्राहकों के भुगतान से लगभग ${S(p.inflow)} आएँगे, और खर्च और बिलों में लगभग ${S(p.outflow)} जाएँगे। इसलिए अंत में आपके पास करीब ${S(p.balance)} होने चाहिए। यह एक अनुमान है। अगर ग्राहक देर से भुगतान करें तो यह कम होगा।`,
        `हा तुमचा ${days} दिवसांचा रोख अंदाज आहे. आज तुमच्याकडे ${S(f.currentCash)} आहेत. पुढील ${days} दिवसांत विक्री आणि ग्राहकांच्या पेमेंटमधून सुमारे ${S(p.inflow)} येतील, आणि खर्च व बिलांसाठी सुमारे ${S(p.outflow)} जातील. म्हणून शेवटी तुमच्याकडे सुमारे ${S(p.balance)} असायला हवेत. हा एक अंदाज आहे. ग्राहकांनी उशिरा पेमेंट केले तर तो कमी असेल.`,
      ),
    };
  };
  return { en: mk("en"), hi: mk("hi"), mr: mk("mr") };
}

/* ------------------------------------------------------------------ */
/* 4. Month on month                                                   */
/* ------------------------------------------------------------------ */

export function whyChange(f: Fin): WhyContent {
  const mo = f.monthOverMonth;
  const mk = (lang: Lang): WhyBody => {
    const t = pick(lang);
    const M = (n: number) => money(n, lang);
    const S = (n: number) => say(n, lang);
    const title = t("Why things changed this month", "इस महीने बदलाव क्यों हुआ", "या महिन्यात बदल का झाला");

    if (!mo || !mo.hasComparison) {
      return {
        title,
        tone: "info",
        headline: t(
          "FinSight needs records from two different months to compare.",
          "तुलना के लिए FinSight को दो अलग-अलग महीनों के रिकॉर्ड चाहिए।",
          "तुलनेसाठी FinSight ला दोन वेगवेगळ्या महिन्यांच्या नोंदी हव्यात.",
        ),
        because: [
          {
            label: t("What is missing", "क्या कम है", "काय कमी आहे"),
            detail: t(
              "Right now all your records fall in one month, so there is nothing to compare it with.",
              "अभी आपके सारे रिकॉर्ड एक ही महीने के हैं, इसलिए तुलना के लिए कुछ नहीं है।",
              "सध्या तुमच्या सर्व नोंदी एकाच महिन्यातील आहेत, म्हणून तुलना करण्यासाठी काही नाही.",
            ),
          },
        ],
        meaning: t(
          "Once next month's records are added, you will see exactly what rose, what fell and why.",
          "अगले महीने के रिकॉर्ड जुड़ते ही आप देखेंगे कि क्या बढ़ा, क्या घटा और क्यों।",
          "पुढील महिन्याच्या नोंदी जोडताच काय वाढले, काय घटले आणि का ते तुम्हाला दिसेल.",
        ),
        next: [
          t("Add transactions for the next month.", "अगले महीने के लेन-देन जोड़ें।", "पुढील महिन्याचे व्यवहार जोडा."),
        ],
        voice: t(
          "I cannot compare months yet. Please add records from another month, and I will show you what changed.",
          "मैं अभी महीनों की तुलना नहीं कर सकता। कृपया दूसरे महीने के रिकॉर्ड जोड़ें, फिर मैं बताऊँगा कि क्या बदला।",
          "मी अजून महिन्यांची तुलना करू शकत नाही. कृपया दुसऱ्या महिन्याच्या नोंदी जोडा, मग मी काय बदलले ते सांगेन.",
        ),
      };
    }

    const [rev, exp, net] = mo.changes;
    const top = mo.categoryChanges[0];
    const up = net.current >= net.previous;
    const pl = mo.previousLabel ?? "";
    const cl = mo.currentLabel;
    const catDelta = top ? top.current - top.previous : 0;
    return {
      title,
      tone: up ? "good" : "watch",
      headline: t(
        `Your net cash flow ${up ? "improved" : "fell"} from ${M(net.previous)} in ${pl} to ${M(net.current)} in ${cl}.`,
        `आपका शुद्ध नकदी प्रवाह ${pl} के ${M(net.previous)} से ${up ? "सुधरकर" : "घटकर"} ${cl} में ${M(net.current)} हो गया।`,
        `तुमचा निव्वळ रोख प्रवाह ${pl} मधील ${M(net.previous)} वरून ${cl} मध्ये ${M(net.current)} ${up ? "पर्यंत सुधारला" : "पर्यंत घटला"}.`,
      ),
      because: [
        {
          label: t("Revenue", "कमाई", "कमाई"),
          value: `${M(rev.previous)} → ${M(rev.current)}`,
          detail: t(
            `Sales ${rev.direction === "up" ? "rose" : rev.direction === "down" ? "fell" : "stayed the same"}${rev.deltaPct === null ? " (a new source of income)" : `: ${rev.deltaPct >= 0 ? "+" : ""}${Math.round(rev.deltaPct)}%`}.`,
            `बिक्री ${rev.direction === "up" ? "बढ़ी" : rev.direction === "down" ? "घटी" : "वैसी ही रही"}${rev.deltaPct === null ? " (आय का नया स्रोत)" : `: ${rev.deltaPct >= 0 ? "+" : ""}${Math.round(rev.deltaPct)}%`}।`,
            `विक्री ${rev.direction === "up" ? "वाढली" : rev.direction === "down" ? "घटली" : "तशीच राहिली"}${rev.deltaPct === null ? " (उत्पन्नाचा नवीन स्रोत)" : `: ${rev.deltaPct >= 0 ? "+" : ""}${Math.round(rev.deltaPct)}%`}.`,
          ),
        },
        {
          label: t("Expenses", "खर्च", "खर्च"),
          value: `${M(exp.previous)} → ${M(exp.current)}`,
          detail: t(
            `Spending ${exp.direction === "up" ? "rose" : exp.direction === "down" ? "fell" : "stayed the same"}${exp.deltaPct === null ? "" : `: ${exp.deltaPct >= 0 ? "+" : ""}${Math.round(exp.deltaPct)}%`}.`,
            `खर्च ${exp.direction === "up" ? "बढ़ा" : exp.direction === "down" ? "घटा" : "वैसा ही रहा"}${exp.deltaPct === null ? "" : `: ${exp.deltaPct >= 0 ? "+" : ""}${Math.round(exp.deltaPct)}%`}।`,
            `खर्च ${exp.direction === "up" ? "वाढला" : exp.direction === "down" ? "घटला" : "तसाच राहिला"}${exp.deltaPct === null ? "" : `: ${exp.deltaPct >= 0 ? "+" : ""}${Math.round(exp.deltaPct)}%`}.`,
          ),
        },
        {
          label: t("Net cash flow", "शुद्ध नकदी प्रवाह", "निव्वळ रोख प्रवाह"),
          value: `${M(net.previous)} → ${M(net.current)}`,
          detail: t(
            `Net moves by the gap between the two: revenue changed by ${M(rev.current - rev.previous)} and expenses changed by ${M(exp.current - exp.previous)}.`,
            `शुद्ध प्रवाह इन दोनों के अंतर से बदलता है: कमाई ${M(rev.current - rev.previous)} बदली और खर्च ${M(exp.current - exp.previous)} बदला।`,
            `निव्वळ प्रवाह या दोघांच्या फरकाने बदलतो: कमाई ${M(rev.current - rev.previous)} बदलली आणि खर्च ${M(exp.current - exp.previous)} बदलला.`,
          ),
        },
        ...(top
          ? [
              {
                label: t("Biggest category move", "सबसे बड़ा श्रेणी बदलाव", "सर्वात मोठा श्रेणी बदल"),
                value: `${top.category}: ${M(top.previous)} → ${M(top.current)}`,
                detail: t(
                  `${top.category} moved the most (${catDelta >= 0 ? "+" : ""}${M(catDelta)}). Start your review here.`,
                  `${top.category} में सबसे ज़्यादा बदलाव हुआ (${catDelta >= 0 ? "+" : ""}${M(catDelta)})। समीक्षा यहीं से शुरू करें।`,
                  `${top.category} मध्ये सर्वाधिक बदल झाला (${catDelta >= 0 ? "+" : ""}${M(catDelta)}). आढावा इथून सुरू करा.`,
                ),
              },
            ]
          : []),
      ],
      meaning: up
        ? t(
            "Your business kept more of each month's earnings. Check what worked so you can repeat it.",
            "आपके व्यवसाय ने हर महीने की कमाई में से ज़्यादा बचाया। देखें कि क्या कारगर रहा ताकि उसे दोहराया जा सके।",
            "तुमच्या व्यवसायाने प्रत्येक महिन्याच्या कमाईतून जास्त शिल्लक ठेवली. काय यशस्वी ठरले ते पहा, म्हणजे ते पुन्हा करता येईल.",
          )
        : t(
            "You kept less this month than last. Look at the biggest category move first, since that is usually the main cause.",
            "इस महीने आपने पिछले महीने से कम बचाया। सबसे बड़े श्रेणी बदलाव को पहले देखें, क्योंकि आमतौर पर वही मुख्य कारण होता है।",
            "या महिन्यात तुम्ही मागील महिन्यापेक्षा कमी शिल्लक ठेवली. सर्वात मोठा श्रेणी बदल आधी पहा, कारण तोच सहसा मुख्य कारण असतो.",
          ),
      next: [
        top
          ? t(
              `Open Transactions and review ${top.category}.`,
              `Transactions खोलकर ${top.category} की समीक्षा करें।`,
              `Transactions उघडून ${top.category} चा आढावा घ्या.`,
            )
          : t("Review your largest expenses.", "अपने सबसे बड़े खर्च देखें।", "तुमचे सर्वात मोठे खर्च पहा."),
        t(
          "Use the What-if simulator to see how fixing it would change next month.",
          "What-if सिमुलेटर से देखें कि इसे सुधारने पर अगला महीना कैसा होगा।",
          "ते सुधारल्यास पुढील महिना कसा असेल हे What-if सिम्युलेटरमध्ये पहा.",
        ),
      ],
      voice: t(
        `Here is what changed. In ${pl} you earned ${S(rev.previous)}. In ${cl} you earned ${S(rev.current)}. Your spending went from ${S(exp.previous)} to ${S(exp.current)}. So the money you kept ${up ? "went up" : "went down"}, from ${S(net.previous)} to ${S(net.current)}. ${top ? `The biggest change was in ${top.category}.` : ""}`,
        `देखिए क्या बदला। ${pl} में आपने ${S(rev.previous)} कमाए। ${cl} में ${S(rev.current)} कमाए। आपका खर्च ${S(exp.previous)} से ${S(exp.current)} हो गया। इसलिए बचत ${up ? "बढ़ी" : "घटी"}, ${S(net.previous)} से ${S(net.current)}। ${top ? `सबसे बड़ा बदलाव ${top.category} में हुआ।` : ""}`,
        `काय बदलले ते पहा. ${pl} मध्ये तुम्ही ${S(rev.previous)} कमावले. ${cl} मध्ये ${S(rev.current)} कमावले. तुमचा खर्च आधी ${S(exp.previous)} होता, आता ${S(exp.current)} झाला. म्हणून शिल्लक ${up ? "वाढली" : "घटली"}: आधी ${S(net.previous)} होती, आता ${S(net.current)} आहे. ${top ? `सर्वात मोठा बदल ${top.category} मध्ये झाला.` : ""}`,
      ),
    };
  };
  return { en: mk("en"), hi: mk("hi"), mr: mk("mr") };
}

/* ------------------------------------------------------------------ */
/* 5. What-if simulator                                                */
/* ------------------------------------------------------------------ */

export interface SimValues {
  revenue: number;
  raw: number;
  transport: number;
  labour: number;
}
/** Share of total expenses each lever represents (matches SimulatorPage). */
export const SIM_WEIGHT = { raw: 0.39, transport: 0.13, labour: 0.2 };

export function whySimulator(f: Fin, v: SimValues): WhyContent {
  const revenue = f.revenue * (1 + v.revenue / 100);
  const expenses =
    f.expenseTotal *
    (1 +
      (v.raw * SIM_WEIGHT.raw +
        v.transport * SIM_WEIGHT.transport +
        v.labour * SIM_WEIGHT.labour) /
        100);
  const net = revenue - expenses;
  const diff = net - f.netCashFlow;
  const untouched = !v.revenue && !v.raw && !v.transport && !v.labour;

  const mk = (lang: Lang): WhyBody => {
    const t = pick(lang);
    const M = (n: number) => money(n, lang);
    const S = (n: number) => say(n, lang);
    const sign = (n: number) => `${n > 0 ? "+" : ""}${n}%`;
    const revEffect = f.revenue * (v.revenue / 100);
    const rawEffect = -f.expenseTotal * ((v.raw * SIM_WEIGHT.raw) / 100);
    const trEffect = -f.expenseTotal * ((v.transport * SIM_WEIGHT.transport) / 100);
    const labEffect = -f.expenseTotal * ((v.labour * SIM_WEIGHT.labour) / 100);

    return {
      title: t("Why the simulator shows this result", "सिमुलेटर यह नतीजा क्यों दिखा रहा है", "सिम्युलेटर हा निकाल का दाखवतो"),
      tone: untouched ? "info" : diff >= 0 ? "good" : "watch",
      headline: untouched
        ? t(
            "You have not moved any slider yet, so the result is the same as your current records.",
            "आपने अभी कोई स्लाइडर नहीं हिलाया, इसलिए नतीजा आपके मौजूदा रिकॉर्ड जैसा ही है।",
            "तुम्ही अजून कोणताही स्लायडर हलवलेला नाही, म्हणून निकाल तुमच्या सध्याच्या नोंदींसारखाच आहे.",
          )
        : t(
            `With your changes, you would keep ${M(Math.abs(diff))} ${diff >= 0 ? "more" : "less"} than today.`,
            `आपके बदलावों से आप आज की तुलना में ${M(Math.abs(diff))} ${diff >= 0 ? "ज़्यादा" : "कम"} बचाएँगे।`,
            `तुमच्या बदलांमुळे तुम्ही आजच्या तुलनेत ${M(Math.abs(diff))} ${diff >= 0 ? "जास्त" : "कमी"} शिल्लक ठेवाल.`,
          ),
      because: [
        {
          label: t(`Revenue ${sign(v.revenue)}`, `कमाई ${sign(v.revenue)}`, `कमाई ${sign(v.revenue)}`),
          value: `${revEffect >= 0 ? "+" : ""}${M(revEffect)}`,
          detail: t(
            `${sign(v.revenue)} of your ${M(f.revenue)} revenue.`,
            `आपकी ${M(f.revenue)} की कमाई का ${sign(v.revenue)}।`,
            `तुमच्या ${M(f.revenue)} कमाईच्या ${sign(v.revenue)}.`,
          ),
        },
        {
          label: t(`Raw material cost ${sign(v.raw)}`, `कच्चे माल की लागत ${sign(v.raw)}`, `कच्च्या मालाची किंमत ${sign(v.raw)}`),
          value: `${rawEffect >= 0 ? "+" : ""}${M(rawEffect)}`,
          detail: t(
            `Raw material is about ${Math.round(SIM_WEIGHT.raw * 100)}% of your total spending, so a ${sign(v.raw)} change moves total expenses by about ${(v.raw * SIM_WEIGHT.raw).toFixed(1)}%.`,
            `कच्चा माल आपके कुल खर्च का लगभग ${Math.round(SIM_WEIGHT.raw * 100)}% है, इसलिए ${sign(v.raw)} बदलाव से कुल खर्च लगभग ${(v.raw * SIM_WEIGHT.raw).toFixed(1)}% बदलता है।`,
            `कच्चा माल तुमच्या एकूण खर्चाच्या सुमारे ${Math.round(SIM_WEIGHT.raw * 100)}% आहे, म्हणून ${sign(v.raw)} बदलाने एकूण खर्च सुमारे ${(v.raw * SIM_WEIGHT.raw).toFixed(1)}% बदलतो.`,
          ),
        },
        {
          label: t(`Transport cost ${sign(v.transport)}`, `ढुलाई की लागत ${sign(v.transport)}`, `वाहतुकीची किंमत ${sign(v.transport)}`),
          value: `${trEffect >= 0 ? "+" : ""}${M(trEffect)}`,
          detail: t(
            `Transport is about ${Math.round(SIM_WEIGHT.transport * 100)}% of your total spending.`,
            `ढुलाई आपके कुल खर्च का लगभग ${Math.round(SIM_WEIGHT.transport * 100)}% है।`,
            `वाहतूक तुमच्या एकूण खर्चाच्या सुमारे ${Math.round(SIM_WEIGHT.transport * 100)}% आहे.`,
          ),
        },
        {
          label: t(`Labour cost ${sign(v.labour)}`, `मज़दूरी की लागत ${sign(v.labour)}`, `मजुरीची किंमत ${sign(v.labour)}`),
          value: `${labEffect >= 0 ? "+" : ""}${M(labEffect)}`,
          detail: t(
            `Labour is about ${Math.round(SIM_WEIGHT.labour * 100)}% of your total spending.`,
            `मज़दूरी आपके कुल खर्च का लगभग ${Math.round(SIM_WEIGHT.labour * 100)}% है।`,
            `मजुरी तुमच्या एकूण खर्चाच्या सुमारे ${Math.round(SIM_WEIGHT.labour * 100)}% आहे.`,
          ),
        },
        {
          label: t("Final result", "अंतिम नतीजा", "अंतिम निकाल"),
          value: M(net),
          detail: t(
            `New revenue ${M(revenue)} minus new expenses ${M(expenses)}. Your cash would become ${M(f.currentCash + net)}.`,
            `नई कमाई ${M(revenue)} में से नया खर्च ${M(expenses)} घटाकर। आपकी नकदी ${M(f.currentCash + net)} हो जाएगी।`,
            `नवीन कमाई ${M(revenue)} मधून नवीन खर्च ${M(expenses)} वजा करून. तुमची रोख ${M(f.currentCash + net)} होईल.`,
          ),
        },
      ],
      meaning: t(
        "The simulator is a safe place to test decisions. Nothing you change here is saved to your real books.",
        "सिमुलेटर फ़ैसलों को आज़माने की सुरक्षित जगह है। यहाँ आप जो भी बदलें, वह आपके असली हिसाब में सेव नहीं होता।",
        "सिम्युलेटर हे निर्णय तपासण्याची सुरक्षित जागा आहे. इथे तुम्ही जे बदलाल ते तुमच्या खऱ्या हिशेबात सेव्ह होत नाही.",
      ),
      next: [
        t(
          "Try raising revenue by 5% and raw material by 5% together to see if a price rise covers a cost rise.",
          "कमाई 5% और कच्चा माल 5% साथ में बढ़ाकर देखें कि दाम बढ़ाने से लागत की बढ़त पूरी होती है या नहीं।",
          "कमाई 5% आणि कच्चा माल 5% एकत्र वाढवून पहा, म्हणजे भाववाढ खर्चवाढ भरून काढते का ते कळेल.",
        ),
        t(
          "Press Reset to go back to your real numbers.",
          "अपने असली आँकड़ों पर लौटने के लिए Reset दबाएँ।",
          "तुमच्या खऱ्या आकड्यांवर परतण्यासाठी Reset दाबा.",
        ),
      ],
      voice: untouched
        ? t(
            "This is the what-if simulator. Move the sliders to test a decision, like a price rise or a cost increase. Right now nothing is changed, so the result matches your real numbers.",
            "यह व्हाट-इफ सिमुलेटर है। दाम बढ़ाने या लागत बढ़ने जैसे फ़ैसले को आज़माने के लिए स्लाइडर हिलाइए। अभी कुछ बदला नहीं है, इसलिए नतीजा आपके असली आँकड़ों जैसा है।",
            "हा व्हॉट-इफ सिम्युलेटर आहे. भाववाढ किंवा खर्चवाढ यांसारखा निर्णय तपासण्यासाठी स्लायडर हलवा. सध्या काहीही बदललेले नाही, म्हणून निकाल तुमच्या खऱ्या आकड्यांसारखाच आहे.",
          )
        : t(
            `With the changes you chose, your sales would be ${S(revenue)} and your spending ${S(expenses)}. So you would keep ${S(net)}. Compared to today, that is ${S(Math.abs(diff))} ${diff >= 0 ? "more" : "less"}. Nothing here changes your real books. It is only a test.`,
            `आपके चुने बदलावों के साथ बिक्री ${S(revenue)} और खर्च ${S(expenses)} होगा। इसलिए आप ${S(net)} बचाएँगे। आज की तुलना में यह ${S(Math.abs(diff))} ${diff >= 0 ? "ज़्यादा" : "कम"} है। यहाँ कुछ भी आपके असली हिसाब को नहीं बदलता। यह सिर्फ़ एक परीक्षण है।`,
            `तुम्ही निवडलेल्या बदलांसह विक्री ${S(revenue)} आणि खर्च ${S(expenses)} होईल. म्हणून तुम्ही ${S(net)} शिल्लक ठेवाल. आजच्या तुलनेत हे ${S(Math.abs(diff))} ${diff >= 0 ? "जास्त" : "कमी"} आहे. इथे काहीही तुमचा खरा हिशेब बदलत नाही. ही फक्त एक चाचणी आहे.`,
          ),
    };
  };
  return { en: mk("en"), hi: mk("hi"), mr: mk("mr") };
}
