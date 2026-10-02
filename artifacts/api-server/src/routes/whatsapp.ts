import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, businesses, transactions } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  detectLang,
  parseMessage,
  replyHelp,
  replyLogged,
  replyNotLinked,
  replyNothingToUndo,
  replyUndone,
  replyUnknown,
  xmlEscape,
} from "../lib/whatsappParser";

const router: IRouter = Router();

/** "whatsapp:+919876543210" -> "+919876543210" (how we store it). */
function stripWhatsappPrefix(from: string | undefined): string | null {
  if (!from) return null;
  return from.replace(/^whatsapp:/, "");
}

/** Today's date in India as YYYY-MM-DD (the server may run in another timezone). */
function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Sends a reply back to the person on WhatsApp (Twilio reads this XML). */
function reply(res: import("express").Response, text: string | null) {
  res.set("Content-Type", "text/xml");
  res
    .status(200)
    .send(
      text === null
        ? "<Response></Response>"
        : `<Response><Message>${xmlEscape(text)}</Message></Response>`,
    );
}

// Remembers each person's most recent entry so they can reply UNDO.
// In-memory on purpose (simple + fast); it resets if the server restarts.
const lastEntry = new Map<
  string,
  { id: number; businessId: number; description: string }
>();

// Twilio retries a webhook if we answer slowly. Remember recent message IDs
// so a retry never logs the same expense twice.
const seenMessageSids = new Set<string>();
function alreadyHandled(sid: string | undefined): boolean {
  if (!sid) return false;
  if (seenMessageSids.has(sid)) return true;
  seenMessageSids.add(sid);
  if (seenMessageSids.size > 500) {
    const oldest = seenMessageSids.values().next().value;
    if (oldest) seenMessageSids.delete(oldest);
  }
  return false;
}

/**
 * Deliberately NOT behind requireAuth: Twilio has no Clerk session. The
 * sender's phone number (matched against businesses.whatsapp_phone) decides
 * whose books a message is written to.
 */
router.post("/whatsapp/webhook", async (req, res) => {
  const from = stripWhatsappPrefix(req.body.From);
  const body = (req.body.Body as string | undefined)?.trim();

  // Delivery-status pings (sent / delivered / read) carry no message text.
  if (!from || !body) {
    reply(res, null);
    return;
  }
  if (alreadyHandled(req.body.MessageSid)) {
    reply(res, null);
    return;
  }

  logger.info({ from, body }, "WhatsApp message received");
  const lang = detectLang(body);

  try {
    const match = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.whatsappPhone, from))
      .limit(1);
    const business = match[0];

    if (!business) {
      reply(res, replyNotLinked(lang, from));
      return;
    }

    const parsed = parseMessage(body);

    if (parsed.kind === "help") {
      reply(res, replyHelp(lang));
      return;
    }

    if (parsed.kind === "unknown") {
      reply(res, replyUnknown(lang, parsed.reason));
      return;
    }

    if (parsed.kind === "undo") {
      const last = lastEntry.get(from);
      if (!last) {
        reply(res, replyNothingToUndo(lang));
        return;
      }
      const removed = await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, last.id),
            eq(transactions.businessId, last.businessId),
          ),
        )
        .returning({ id: transactions.id });
      lastEntry.delete(from);
      reply(
        res,
        removed.length ? replyUndone(lang, last.description) : replyNothingToUndo(lang),
      );
      return;
    }

    // expense or revenue: save it, exactly like the in-app form does.
    const [row] = await db
      .insert(transactions)
      .values({
        businessId: business.id,
        type: parsed.kind,
        description: parsed.description,
        amount: String(parsed.amount),
        category: parsed.category,
        vendor: parsed.vendor,
        customer: parsed.customer,
        date: todayIST(),
        status: "Cleared",
        source: "whatsapp",
      })
      .returning({ id: transactions.id });

    lastEntry.set(from, {
      id: row.id,
      businessId: business.id,
      description: parsed.description,
    });

    logger.info(
      { businessId: business.id, kind: parsed.kind, amount: parsed.amount, category: parsed.category },
      "WhatsApp entry saved",
    );
    reply(res, replyLogged(lang, parsed));
  } catch (error) {
    logger.error({ err: error }, "WhatsApp webhook failed");
    reply(res, "Sorry, something went wrong on our side. Please try again in a moment.");
  }
});

export default router;
