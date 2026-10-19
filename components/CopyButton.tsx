"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

export function CopyButton({ text, label, copied }: { text: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.small}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
        } catch {
          setDone(false);
        }
      }}
    >
      <span aria-live="polite">{done ? copied : label}</span>
    </button>
  );
}
