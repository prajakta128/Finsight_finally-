import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  Square,
  Volume2,
  X,
} from "lucide-react";
import type { BusinessBootstrap } from "@workspace/api-client-react";
import { useLanguage } from "../lib/LanguageContext";
import { LANGUAGES, type Lang } from "../lib/i18n";
import { WHY_UI, whyAlert, type WhyContent, type WhyTone } from "../lib/why";
import { speakWhy, stopWhy, voiceSupported } from "../lib/whyVoice";
import type { ActionItem, calculateFinancials } from "../lib/financials";

type Fin = ReturnType<typeof calculateFinancials>;

const TONE_STYLE: Record<WhyTone, string> = {
  good: "bg-[#e0f0e8] text-[#28715e]",
  watch: "bg-[#fbecd4] text-[#9a641e]",
  risk: "bg-[#f7dfda] text-[#a3463d]",
  info: "bg-[#deedf1] text-[#397285]",
};

/* ------------------------------------------------------------------ */
/* The explanation popup                                               */
/* ------------------------------------------------------------------ */

export function WhyModal({
  content,
  onClose,
  autoListen = false,
}: {
  content: WhyContent;
  onClose: () => void;
  autoListen?: boolean;
}) {
  const { lang: appLang } = useLanguage();
  const [lang, setLang] = useState<Lang>(appLang);
  const [speaking, setSpeaking] = useState(false);
  const [slow, setSlow] = useState(false);
  const [voiceNote, setVoiceNote] = useState(false);
  const ui = WHY_UI[lang];
  const body = content[lang];
  const supported = useMemo(() => voiceSupported(), []);
  const first = useRef(true);

  const listen = (l: Lang = lang, s: boolean = slow) => {
    const res = speakWhy(content[l].voice, l, {
      slow: s,
      onEnd: () => setSpeaking(false),
    });
    setSpeaking(res.started);
    setVoiceNote(res.started && !res.exact);
  };
  const stop = () => {
    stopWhy();
    setSpeaking(false);
  };

  // Close on Escape, always stop talking when the popup closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stopWhy();
    };
  }, [onClose]);

  // Optional: start talking as soon as the popup opens.
  useEffect(() => {
    if (autoListen) listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching language mid-way: restart in the new language if it was talking.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (speaking) listen(lang);
    else setVoiceNote(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#18323a]/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={body.title}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-card-border bg-card shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CircleHelp size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
              {ui.kicker}
            </div>
            <h2 className="font-display text-lg font-semibold leading-snug tracking-tight">
              {body.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ui.close}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Language tabs */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-2.5 sm:px-6">
          <div className="inline-flex gap-1 rounded-xl border border-border bg-background p-1 text-xs font-semibold">
            {LANGUAGES.map((o) => (
              <button
                key={o.code}
                type="button"
                onClick={() => setLang(o.code)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${lang === o.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_STYLE[body.tone]}`}
          >
            {ui.tone[body.tone]}
          </span>
        </div>

        {/* Scrollable body */}
        <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Short answer */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {ui.short}
            </div>
            <p className="text-[15px] font-semibold leading-7">{body.headline}</p>
          </div>

          {/* Voice card */}
          <div className="rounded-2xl border border-[#d3e7df] bg-[#f2faf6] p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {ui.simple}
              </span>
              {supported && (
                <div className="ml-auto flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-[11px] font-semibold">
                    {[false, true].map((s) => (
                      <button
                        key={String(s)}
                        type="button"
                        onClick={() => {
                          setSlow(s);
                          if (speaking) listen(lang, s);
                        }}
                        className={`rounded-md px-2.5 py-1 ${slow === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {s ? ui.slow : ui.normal}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => (speaking ? stop() : listen())}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    {speaking ? (
                      <>
                        <Square size={13} /> {ui.stop}
                      </>
                    ) : (
                      <>
                        <Volume2 size={14} /> {ui.listen}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm leading-7">{body.voice}</p>
            {speaking && (
              <div className="mt-2 flex items-end gap-0.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 animate-pulse rounded-full bg-primary"
                    style={{ height: 6 + ((i * 7) % 12), animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            )}
            {!supported && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {ui.voiceUnsupported}
              </p>
            )}
            {voiceNote && (
              <p className="mt-2 text-[11px] text-muted-foreground">{ui.noVoice}</p>
            )}
          </div>

          {/* How it was worked out */}
          {body.because.length > 0 && (
            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {ui.how}
              </div>
              <ol className="space-y-2.5">
                {body.because.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border bg-background p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] font-semibold">{s.label}</span>
                      {s.value && (
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-bold">
                          {s.value}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {s.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Meaning */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {ui.meaning}
            </div>
            <p className="text-sm leading-6">{body.meaning}</p>
          </div>

          {/* Next steps */}
          {body.next.length > 0 && (
            <div className="rounded-2xl bg-muted/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Lightbulb size={13} className="text-accent" /> {ui.next}
              </div>
              <ul className="space-y-2">
                {body.next.map((n, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-5">
                    <CheckCircle2
                      size={15}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* The "Why?" button you drop next to any number or card               */
/* ------------------------------------------------------------------ */

export function WhyButton({
  build,
  variant = "pill",
  autoListen = false,
  label: labelOverride,
  className = "",
}: {
  /** Called only when the button is pressed, so it always uses fresh data. */
  build: () => WhyContent;
  variant?: "pill" | "icon";
  /** Open the popup and start reading it aloud straight away. */
  autoListen?: boolean;
  /** Custom text, e.g. "Listen". Defaults to "Why?" in the current language. */
  label?: string;
  className?: string;
}) {
  const { lang } = useLanguage();
  const [content, setContent] = useState<WhyContent | null>(null);
  const label = labelOverride ?? WHY_UI[lang].button;
  const Icon = autoListen ? Volume2 : CircleHelp;
  return (
    <>
      <button
        type="button"
        onClick={() => setContent(build())}
        aria-label={`${label} — ${WHY_UI[lang].kicker}`}
        className={
          variant === "icon"
            ? `grid size-7 place-items-center rounded-full text-primary hover:bg-[#e0f0e8] ${className}`
            : `inline-flex items-center gap-1.5 rounded-full border border-[#cfe3da] bg-[#f2faf6] px-3 py-1.5 text-[11px] font-bold text-primary transition hover:bg-[#e0f0e8] ${className}`
        }
      >
        <Icon size={variant === "icon" ? 17 : 13} />
        {variant === "pill" && label}
      </button>
      {content && (
        <WhyModal
          content={content}
          autoListen={autoListen}
          onClose={() => setContent(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Notification bell (header) + toast + optional phone/desktop alerts  */
/* ------------------------------------------------------------------ */

const SEEN_KEY = "finsight_seen_alerts";
const NOTIFIED_KEY = "finsight_notified_alerts";

const readSet = (storage: Storage, key: string): string[] => {
  try {
    return JSON.parse(storage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
};
const writeSet = (storage: Storage, key: string, value: string[]) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked (private mode) - the feature just won't remember */
  }
};

export function NotificationBell({
  f,
  data,
}: {
  f: Fin;
  data: BusinessBootstrap;
}) {
  const { lang } = useLanguage();
  const ui = WHY_UI[lang];
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>(() => readSet(localStorage, SEEN_KEY));
  const [whyFor, setWhyFor] = useState<ActionItem | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  // Only real problems count as notifications (not the "all good" baseline).
  const alerts = f.actions.filter((a) => a.kind !== "baseline");
  const unseen = alerts.filter((a) => !seen.includes(a.id));

  // Toast (and optional system notification) once per alert per browser session.
  useEffect(() => {
    const notified = readSet(sessionStorage, NOTIFIED_KEY);
    const fresh = unseen.filter((a) => !notified.includes(a.id));
    if (fresh.length === 0) return;
    writeSet(sessionStorage, NOTIFIED_KEY, [...notified, ...fresh.map((a) => a.id)]);

    toast(WHY_UI[lang].toastTitle(fresh.length), {
      description: fresh[0].title,
      duration: 9000,
      action: {
        label: WHY_UI[lang].button,
        onClick: () => setWhyFor(fresh[0]),
      },
    });

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      fresh.slice(0, 3).forEach((a) => {
        try {
          new Notification("FinSight", { body: a.title });
        } catch {
          /* some mobile browsers only allow notifications via service worker */
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.map((a) => a.id).join("|")]);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unseen.length) {
      const all = Array.from(new Set([...seen, ...alerts.map((a) => a.id)]));
      setSeen(all);
      writeSet(localStorage, SEEN_KEY, all);
    }
  };

  const enableSystem = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPerm(result);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={ui.bellTitle}
        className="relative grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Bell size={16} />
        {unseen.length > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#d87855] text-[9px] font-bold text-white">
            {unseen.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            {ui.bellTitle}
          </div>
          <div className="scrollbar-thin max-h-[360px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                {ui.bellEmpty}
              </p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${a.tone === "red" ? "bg-[#d87855]" : a.tone === "amber" ? "bg-[#de9b42]" : "bg-[#5a91a8]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-5">{a.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {a.text}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWhyFor(a);
                        setOpen(false);
                      }}
                      className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#cfe3da] bg-[#f2faf6] px-2.5 py-1 text-[11px] font-bold text-primary"
                    >
                      <CircleHelp size={12} /> {ui.button}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {perm !== "unsupported" && (
            <div className="border-t border-border bg-muted/40 px-4 py-2.5">
              {perm === "granted" ? (
                <span className="text-[11px] text-muted-foreground">{ui.alertsOn}</span>
              ) : perm === "denied" ? null : (
                <button
                  type="button"
                  onClick={enableSystem}
                  className="text-[11px] font-bold text-primary"
                >
                  {ui.enableAlerts}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {whyFor && (
        <WhyModal
          content={whyAlert(whyFor, f, data)}
          onClose={() => setWhyFor(null)}
        />
      )}
    </div>
  );
}
