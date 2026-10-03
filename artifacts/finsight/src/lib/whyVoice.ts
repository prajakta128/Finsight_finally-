/**
 * Voice playback for the "Why?" feature.
 *
 * Why not just reuse speak() from i18n.ts?
 *  - speak() reads ONE utterance. Chrome silently stops long utterances after
 *    ~15 seconds, and "why" explanations are longer than a form hint. Here the
 *    text is split into sentences and queued, so it never cuts off.
 *  - We need Stop, Slow speed and an "I finished" callback for the UI.
 *  - If the device has no Marathi voice, Hindi is used (same Devanagari
 *    script, so it is still understandable) instead of a silent failure.
 */
import { VOICE_LOCALE, type Lang } from "./i18n";

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function findVoice(lang: Lang): {
  voice: SpeechSynthesisVoice | null;
  exact: boolean;
} {
  if (!voiceSupported()) return { voice: null, exact: false };
  const voices = window.speechSynthesis.getVoices();
  const norm = (s: string) => s.replace("_", "-").toLowerCase();
  const locale = norm(VOICE_LOCALE[lang]);

  const exact =
    voices.find((v) => norm(v.lang) === locale) ??
    voices.find((v) => norm(v.lang).startsWith(lang));
  if (exact) return { voice: exact, exact: true };

  // Marathi falls back to Hindi (same script and very similar sounds).
  if (lang === "mr") {
    const hi = voices.find((v) => norm(v.lang).startsWith("hi"));
    if (hi) return { voice: hi, exact: false };
  }
  return { voice: null, exact: false };
}

/** Splits text into sentence-sized pieces (handles English "." and Hindi/Marathi "।"). */
function toChunks(text: string): string[] {
  const parts = text.match(/[^.!?।]+[.!?।]*/g) ?? [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

export interface SpeakOptions {
  slow?: boolean;
  onEnd?: () => void;
}

/** Reads the text aloud. Returns whether an exact-language voice was found. */
export function speakWhy(
  text: string,
  lang: Lang,
  opts: SpeakOptions = {},
): { started: boolean; exact: boolean } {
  if (!voiceSupported()) return { started: false, exact: false };
  const synth = window.speechSynthesis;
  synth.cancel();

  const { voice, exact } = findVoice(lang);
  const chunks = toChunks(text);
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    opts.onEnd?.();
  };

  // Small delay: some browsers drop speech queued in the same tick as cancel().
  window.setTimeout(() => {
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang || VOICE_LOCALE[lang];
      if (voice) u.voice = voice;
      u.rate = opts.slow ? 0.6 : 0.8;
      u.pitch = 1;
      if (i === chunks.length - 1) u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
  }, 60);

  return { started: true, exact };
}

export function stopWhy() {
  if (voiceSupported()) window.speechSynthesis.cancel();
}

// Voices load asynchronously in Chrome. Touching getVoices() early warms the list.
if (voiceSupported()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}
