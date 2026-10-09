"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarCheck,
  ContactRound,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  UsersRound,
} from "lucide-react";
import {
  VOCABULARY_LOCALES,
  VOCABULARY_PRESET_IDS,
  getTerms,
  type VocabularyConcept,
  type VocabularyLocale,
  type VocabularyPresetId,
} from "@/lib/vocabulary/presets";

// Standard last, like the picker in Settings > Customize.
const ORDER: readonly VocabularyPresetId[] = [
  ...VOCABULARY_PRESET_IDS.filter((id) => id !== "standard"),
  "standard",
];
const CONCEPTS: readonly VocabularyConcept[] = ["inquiry", "booking", "client", "team"];
export const SHOWCASE_CYCLE_MS = 3200;
const ROW_NAMES = ["Santos–Cruz", "Lim", "Reyes"] as const;
const ROW_DATES = [Date.UTC(2026, 1, 14), Date.UTC(2026, 1, 18), Date.UTC(2026, 2, 2)] as const;

const NAV_ICONS = {
  inquiry: MessageSquare,
  booking: CalendarCheck,
  client: ContactRound,
  team: UsersRound,
} as const;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
}
const getReduced = () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_QUERY).matches;
const usePrefersReducedMotion = () => useSyncExternalStore(subscribeReduced, getReduced, () => false);

/** Label that slides up into place when its text changes. Instant when `reduced`. */
function Flip({ text, delay = 0, reduced }: { text: string; delay?: number; reduced: boolean }) {
  if (reduced) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <span className="inline-grid h-[1.4em] overflow-hidden leading-[1.4em]">
      {/* initial={false}: first paint (and SSR) shows the label; only later swaps animate. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className="whitespace-nowrap [grid-area:1/1]"
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function VocabularyShowcase() {
  const t = useTranslations("marketing.vocabulary");
  const rawLocale = useLocale();
  const locale: VocabularyLocale = (VOCABULARY_LOCALES as readonly string[]).includes(rawLocale)
    ? (rawLocale as VocabularyLocale)
    : "en";
  const reduced = usePrefersReducedMotion();

  const [active, setActive] = useState<VocabularyPresetId>("venue");
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(true);
  const [engaged, setEngaged] = useState(false); // pointer/focus inside: timer holds, resumes after
  const sectionRef = useRef<HTMLElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const running = playing && inView && !engaged && !reduced;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(
      () => setActive((cur) => ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]),
      SHOWCASE_CYCLE_MS,
    );
    return () => clearTimeout(id);
  }, [running, active]);

  const choose = (id: VocabularyPresetId) => {
    setPlaying(false); // a user choice ends the tour; the Play button restarts it
    setActive(id);
  };

  const onChipKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const rtl = locale === "ar";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let delta = 0;
    if (e.key === forward || e.key === "ArrowDown") delta = 1;
    else if (e.key === back || e.key === "ArrowUp") delta = -1;
    if (!delta) return;
    e.preventDefault();
    const next = ORDER[(ORDER.indexOf(active) + delta + ORDER.length) % ORDER.length];
    choose(next);
    chipRefs.current[next]?.focus();
  };

  const word = (concept: VocabularyConcept, plural = true, preset: VocabularyPresetId = active) => {
    const term = getTerms(preset, locale, concept);
    return plural ? term.plural : term.singular;
  };
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const lower = (s: string) => s.toLocaleLowerCase(locale);
  const fmtDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });

  const items: { key: string; label: string; flip: boolean; Icon: typeof LayoutDashboard }[] = [
    { key: "dash", label: t("dashboard"), flip: false, Icon: LayoutDashboard },
    ...CONCEPTS.map((c) => ({ key: c, label: cap(word(c)), flip: true, Icon: NAV_ICONS[c] })),
    { key: "portfolio", label: t("portfolio"), flip: false, Icon: ImageIcon },
  ];

  const statusFor = (i: number) => (i === 2 ? cap(word("inquiry", false)) : t("booked"));

  return (
    <section
      ref={sectionRef}
      aria-labelledby="vocabulary-heading"
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocusCapture={() => setEngaged(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEngaged(false);
      }}
      className="border-t border-border bg-background px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 min-[960px]:grid-cols-[5fr_7fr] min-[960px]:gap-14">
        <div className="min-w-0 text-start">
          <h2
            id="vocabulary-heading"
            data-r="rise"
            className="text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("title")}
          </h2>
          <p
            data-r="rise"
            style={{ "--i": 2 } as CSSProperties}
            className="mt-3.5 max-w-md text-base leading-7 text-muted-foreground"
          >
            {t("body")}
          </p>
          <div
            role="radiogroup"
            aria-label={t("chipsLabel")}
            data-r="rise"
            style={{ "--i": 3 } as CSSProperties}
            className="mt-6 flex flex-wrap gap-2"
          >
            {ORDER.map((id) => {
              const on = id === active;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    chipRefs.current[id] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(id)}
                  onKeyDown={onChipKeyDown}
                  className={`relative inline-flex h-9 items-center overflow-hidden rounded-[var(--radius)] border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-muted-foreground"
                  }`}
                >
                  {t(`presets.${id}`)}
                  {on && running ? (
                    <span
                      aria-hidden
                      data-testid="vocabulary-progress"
                      className="mk-prog absolute inset-x-0 bottom-0 h-0.5 bg-current opacity-55"
                      style={{ "--cycle": `${SHOWCASE_CYCLE_MS}ms` } as CSSProperties}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div
            data-r="soft"
            style={{ "--i": 4 } as CSSProperties}
            className="mt-5 flex items-center gap-3 text-sm text-muted-foreground"
          >
            <button
              type="button"
              aria-pressed={!playing}
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
              disabled={reduced}
            >
              {playing ? <PauseIcon className="size-4" aria-hidden /> : <PlayIcon className="size-4" aria-hidden />}
              {playing ? t("pause") : t("play")}
            </button>
            <span>{t("footnote")}</span>
          </div>
        </div>

        <div className="min-w-0">
          <div
            role="img"
            aria-label={t("previewLabel", { words: CONCEPTS.map((c) => word(c)).join(", ") })}
            data-r="rise"
            style={{ "--i": 1 } as CSSProperties}
            className="overflow-hidden rounded-[var(--radius-surface)] bg-card ring-1 ring-foreground/10"
          >
            <div aria-hidden className="flex h-9 items-center gap-1.5 border-b border-border bg-muted px-3">
              <i className="size-2 rounded-full bg-border" />
              <i className="size-2 rounded-full bg-border" />
              <i className="size-2 rounded-full bg-border" />
              <small dir="ltr" className="ms-2 text-xs text-muted-foreground">
                gallurio.com/bookings
              </small>
            </div>
            <div
              aria-hidden
              className="grid min-h-84 grid-cols-[9.5rem_minmax(0,1fr)] min-[560px]:grid-cols-[12rem_minmax(0,1fr)]"
            >
              <div className="flex flex-col gap-0.5 border-e border-border bg-sidebar p-2">
                <div className="mb-1.5 flex items-center gap-2 p-1.5 text-sm font-semibold">
                  <b className="grid size-5.5 place-items-center rounded-[var(--radius)] bg-foreground text-xs font-extrabold text-background">
                    A
                  </b>
                  Aurora
                </div>
                {items.map(({ key, label, flip, Icon }, i) => (
                  <div
                    key={key}
                    className={`flex h-8 items-center gap-2 overflow-hidden rounded-[var(--radius)] px-2 text-sm ${
                      key === "booking" ? "bg-brand/12 font-medium text-brand" : ""
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {flip ? <Flip text={label} delay={(i - 1) * 55} reduced={reduced} /> : <span>{label}</span>}
                  </div>
                ))}
              </div>
              <div className="flex min-w-0 flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">
                    <Flip text={cap(word("booking"))} delay={120} reduced={reduced} />
                  </h3>
                  <span className="inline-flex h-7 items-center gap-1 rounded-[var(--radius)] bg-primary px-2.5 text-xs font-medium whitespace-nowrap text-primary-foreground">
                    <PlusIcon className="size-3" />
                    <Flip text={t("newItem", { item: lower(word("booking", false)) })} delay={180} reduced={reduced} />
                  </span>
                </div>
                <div className="flex h-8 items-center gap-2 overflow-hidden rounded-[var(--radius)] border border-border px-2.5 text-sm whitespace-nowrap text-muted-foreground">
                  <SearchIcon className="size-4 shrink-0" />
                  <Flip text={t("searchItems", { items: lower(word("booking")) })} delay={220} reduced={reduced} />
                </div>
                <div key={active} className="mk-rows flex flex-col">
                  {ROW_NAMES.map((name, i) => (
                    <div
                      key={name}
                      style={{ "--r": i } as CSSProperties}
                      className="mk-row grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-border py-2.5 text-sm"
                    >
                      <span className="truncate font-medium">{name}</span>
                      <span className="col-start-1 truncate text-xs text-muted-foreground">
                        {cap(word("booking", false))} · {fmtDate.format(ROW_DATES[i])}
                      </span>
                      <span className="col-start-2 row-span-2 row-start-1 inline-flex items-center gap-1.5 self-center rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs font-medium">
                        <span aria-hidden className={`size-1.5 rounded-full ${i === 2 ? "bg-muted-foreground" : "bg-brand"}`} />
                        {statusFor(i)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p aria-live="polite" className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
            {CONCEPTS.map((c) => (
              <span key={c}>
                {cap(word(c, true, "standard"))} {"→"} <b className="font-semibold text-foreground">{cap(word(c))}</b>
              </span>
            ))}
            <span>{t("universalNote")}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
