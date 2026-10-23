"use client";

import { Printer } from "lucide-react";

/** Print / save as PDF from the browser's own dialog. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary inline-flex items-center justify-center gap-2 print:hidden">
      <Printer className="h-4 w-4" aria-hidden /> Print or save PDF
    </button>
  );
}
