"use client";

import { useSyncExternalStore } from "react";
import { TextSizeIcon } from "./icons";

const KEY = "text-size";

/** Inline script for <head>: applies the saved text size before the page paints. */
export const textSizeScript = `try{if(localStorage.getItem("${KEY}")==="large")document.documentElement.dataset.text="large"}catch(e){}`;

// the setting lives on <html data-text="large">; watch it so every toggle stays in sync
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-text"] });
  return () => observer.disconnect();
}

const isLarge = () => document.documentElement.dataset.text === "large";

/**
 * "הגדל טקסט": a toggle remembered in this browser. The label stays the same and aria-pressed
 * carries the state, so screen readers announce on/off rather than a changing name.
 */
export function TextSizeToggle({ label }: { label: string }) {
  const large = useSyncExternalStore(subscribe, isLarge, () => false);

  function toggle() {
    const next = !large;
    if (next) document.documentElement.dataset.text = "large";
    else delete document.documentElement.dataset.text;
    try {
      localStorage.setItem(KEY, next ? "large" : "normal");
    } catch {
      // private mode: still works for this page
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={large}
      className="inline-flex min-h-14 items-center gap-2 rounded-xl border-2 border-ink bg-white px-4 font-bold hover:bg-sand"
    >
      <TextSizeIcon className="size-7" />
      {label}
    </button>
  );
}
