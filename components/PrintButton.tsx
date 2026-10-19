"use client";

import { PrintIcon } from "./icons";
import { buttonClass } from "./ui";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass.primary}>
      <PrintIcon className="size-7" />
      {label}
    </button>
  );
}
