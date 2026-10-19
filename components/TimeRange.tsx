"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ARRANGE_BY_MESSAGE, DEFAULT_TIME_RANGE, parseTimeRange, TIMES } from "@/config/options";
import { residentsText as t } from "@/lib/i18n";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "./icons";

// "From" and "until" scroll wheels (owner's request instead of buttons for every hour), each with
// big "earlier"/"later" buttons for those who don't scroll, and an "arrange by message" option.
// The value is one code: "10:00-12:00" or "contact".

const ITEM = 64; // px per row; the wheel shows three rows and the middle one is the choice

export function TimeRange({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const byMessage = value === ARRANGE_BY_MESSAGE;
  // remember the times while "arrange by message" is on, so switching back keeps them
  const [lastRange, setLastRange] = useState(parseTimeRange(value) ? value : DEFAULT_TIME_RANGE);
  const range = parseTimeRange(byMessage ? lastRange : value) ?? parseTimeRange(DEFAULT_TIME_RANGE)!;

  const setRange = (from: string, until: string) => {
    if (until <= from) until = TIMES[Math.min(TIMES.indexOf(from) + 2, TIMES.length - 1)];
    const code = `${from}-${until}`;
    setLastRange(code);
    onChange(code);
  };

  return (
    <div className="space-y-5">
      {!byMessage && (
        <div className="grid grid-cols-2 gap-3">
          <TimeWheel label={t.fields.timeFrom} options={TIMES.slice(0, -1)} value={range.from} onChange={(v) => setRange(v, range.until)} />
          <TimeWheel label={t.fields.timeUntil} options={TIMES.filter((x) => x > range.from)} value={range.until} onChange={(v) => setRange(range.from, v)} />
        </div>
      )}
      <button
        type="button"
        aria-pressed={byMessage}
        onClick={() => onChange(byMessage ? lastRange : ARRANGE_BY_MESSAGE)}
        className={`relative flex min-h-16 w-full items-center justify-center rounded-xl border-4 px-8 py-3 text-center text-xl font-bold ${
          byMessage ? "border-brand bg-brand text-white" : "border-ink bg-white text-ink hover:bg-sand"
        }`}
      >
        {t.fields.arrangeByMessage}
        {byMessage && <CheckIcon className="absolute end-[6px] top-[6px] size-[20px]" />}
      </button>
      {byMessage && <p className="rounded-xl bg-brand-soft p-4 font-bold">{t.fields.arrangeByMessageOn}</p>}
    </div>
  );
}

function TimeWheel({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const labelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const placed = useRef(false);
  // where the wheel is scrolling itself to; that scroll must not count as a choice
  const target = useRef<number | null>(null);
  const latest = useRef({ options, value, onChange });
  useEffect(() => {
    latest.current = { options, value, onChange };
  });
  const index = Math.max(0, options.indexOf(value));
  const pick = (i: number) => onChange(options[Math.min(Math.max(i, 0), options.length - 1)]);

  // keep the chosen time in the middle row (after buttons, keys, or a change of the other wheel)
  useEffect(() => {
    const el = ref.current;
    if (!el || Math.abs(el.scrollTop - index * ITEM) < 2) return;
    const smooth = placed.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.current = index * ITEM;
    el.scrollTo({ top: index * ITEM, behavior: smooth ? "smooth" : "instant" });
    placed.current = true;
  }, [index, options.length]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  // when the person stops scrolling, the time in the middle row becomes the choice
  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const reached = target.current !== null && Math.abs(el.scrollTop - target.current) < 2;
      target.current = null;
      if (reached) return;
      const { options, value, onChange } = latest.current;
      const chosen = options[Math.min(Math.max(Math.round(el.scrollTop / ITEM), 0), options.length - 1)];
      if (chosen !== value) onChange(chosen);
    }, 150);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -4, PageDown: 4 }[e.key];
    if (step) pick(index + step);
    else if (e.key === "Home") pick(0);
    else if (e.key === "End") pick(options.length - 1);
    else return;
    e.preventDefault();
  };

  const arrow = "flex min-h-14 w-full items-center justify-center gap-1 rounded-xl border-2 border-ink bg-white px-2 text-lg font-bold hover:bg-sand disabled:opacity-40";
  return (
    <div className="min-w-0">
      <p id={labelId} className="mb-2 whitespace-nowrap text-center text-xl font-bold">
        {label}
      </p>
      <button type="button" className={arrow} onClick={() => pick(index - 1)} disabled={index === 0}>
        <ChevronUpIcon className="size-6" />
        {t.fields.earlier}
      </button>
      <div className="relative my-2">
        {/* the band marks the chosen row */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[4px] top-[68px] h-[64px] rounded-lg border-4 border-brand bg-brand-soft" />
        <div
          ref={ref}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={options.length - 1}
          aria-valuenow={index}
          aria-valuetext={options[index]}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          dir="ltr"
          className="relative h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl border-4 border-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div aria-hidden="true" style={{ height: ITEM }} />
          {options.map((o, i) => (
            <div
              key={o}
              aria-hidden="true"
              onClick={() => pick(i)}
              style={{ height: ITEM }}
              className={`flex snap-center items-center justify-center text-[1.6rem] leading-none ${i === index ? "font-extrabold" : "font-normal"}`}
            >
              {o}
            </div>
          ))}
          <div aria-hidden="true" style={{ height: ITEM }} />
        </div>
      </div>
      <button type="button" className={arrow} onClick={() => pick(index + 1)} disabled={index === options.length - 1}>
        <ChevronDownIcon className="size-6" />
        {t.fields.later}
      </button>
    </div>
  );
}
