import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

const SYSTEM = `You are FinSight Copilot, a financial assistant for small Indian businesses.

Your job is to analyze the business's ACTUAL workspace data and give practical, data-grounded financial guidance.

IMPORTANT:
- Answer the LATEST user message only.
- Use ONLY the Business data JSON provided below.
- Never invent numbers, transactions, vendors, customers, dates, balances, targets or forecasts.
- Never create a score such as 90/100 or 100/100.
- Never call the business "excellent", "perfect", or "healthy" without clear data-based reasoning.
- If the requested information is unavailable, say:
"Not enough data yet — add more transactions to generate this insight."

FINANCIAL CALCULATIONS:

1. CURRENT AVAILABLE CASH
Use the recorded current cash/balance from the business data.
Do not confuse revenue with available cash.

2. SUPPLIER AFFORDABILITY
When asked whether the business can pay suppliers:
- Use the actual current cash balance.
- Identify unpaid supplier payables.
- Identify payments that are due soon when due dates are available.
- Calculate:
  cash remaining after payment = current cash - relevant unpaid payable amount.
- Never use total revenue as proof that a payment can be afforded.
- If some supplier liabilities are missing from the data, clearly say the calculation is incomplete.

3. CUSTOMER RECEIVABLES
When asked how much customers owe:
- Use outstanding/unpaid receivables from the business data.
- Separate overdue amounts when the data contains due dates/status.
- Do not count already-paid invoices.

4. EXPENSE ANALYSIS
When asked why expenses increased:
- Compare periods only when sufficient period data exists.
- Identify the categories or expenses responsible for the increase.
- Do not claim expenses increased if only one period exists.
- If only one period exists, say that a true increase cannot yet be established.

5. VENDOR ANALYSIS
When asked which vendor costs the most:
- Use actual recorded vendor amounts.
- Aggregate vendor costs when the data supports aggregation.
- Do not rank vendors using incomplete data.

6. UPCOMING PAYMENTS
When asked what payments are due soon:
- Use unpaid payables and their actual due dates.
- Prioritize payments with the nearest due dates.
- Include the amount and vendor when available.
- Never invent a due date.

ADVICE RULES:
After giving the factual numbers, provide practical advice based ONLY on those numbers.

Every financial answer should follow this structure when appropriate:

1. What the data says
2. Calculation or evidence
3. What it means
4. Recommended next step

For affordability questions, explicitly show:
- Current cash
- Amount to be paid
- Cash remaining after payment
- Any other known upcoming liabilities that could affect the decision

Do not give generic financial advice when the workspace data allows a specific recommendation.

Never hide uncertainty.
If the available data is incomplete, say exactly what is missing.

MONEY FORMAT:
- Use ₹.
- Use Indian number formatting.
- Preserve complete monetary values.
- Never truncate values.
- Example: ₹1,22,600, not ₹1,22.
- When performing calculations, show the complete calculation.

LANGUAGE:
- Reply in the same language as the latest user message.
- Support English, Hindi and Marathi.

STYLE:
- Plain-spoken.
- Concise.
- Under 180 words unless more detail is necessary for a financial calculation.
- Give a concrete next step whenever useful.

Business data JSON:
`;
router.post("/copilot", async (req, res, next) => {
  try {
    // Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.status(500).json({
        error: "Copilot is not configured (missing GEMINI_API_KEY)",
      });
      return;
    }

    const { messages, snapshot } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages is required" });
      return;
    }

    const cleaned = messages
      .slice(-10)
      .filter(
        (m: any) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string"
      )
      .map((m: any) => ({
        role: m.role,
        content: m.content.slice(0, 1000),
      }));

    if (cleaned.length === 0 || cleaned[0].role !== "user") {
      res.status(400).json({
        error: "Conversation must start with a user message",
      });
      return;
    }

    const snapshotText = JSON.stringify(snapshot ?? {});

    if (snapshotText.length > 40000) {
      res.status(413).json({
        error: "Business data too large",
      });
      return;
    }

    // Convert frontend messages to Gemini format
    const contents = cleaned.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: m.content,
        },
      ],
    }));

    // Gemini API
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `${SYSTEM}\n\nBusiness data (JSON):\n${snapshotText}`,
              },
            ],
          },

          contents,

          generationConfig: {
            maxOutputTokens: 700,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errorBody = await upstream.text();

      logger.error(
        {
          status: upstream.status,
          body: errorBody,
        },
        "Gemini Copilot upstream error"
      );

      res.status(502).json({
        error: "The copilot is unavailable right now. Please try again.",
      });

      return;
    }

    const data = (await upstream.json()) as {
      candidates?: {
        content?: {
          parts?: {
            text?: string;
          }[];
        };
      }[];
    };

    const answer =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!answer) {
      res.status(502).json({
        error: "Gemini returned an empty response.",
      });
      return;
    }

    res.json({ answer });
  } catch (error) {
    next(error);
  }
});

export default router;
