"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { runScanAction } from "./actions";

export function RunScanButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      const result = await runScanAction();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const n = result.data.casesOpened;
      toast.success(
        n === 0
          ? `Scan complete — no new members absent ${result.data.threshold}+ days`
          : `Scan complete — ${n} ${n === 1 ? "member" : "members"} added to the Red List`
      );
      router.refresh();
    } catch {
      toast.error("We couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={run} disabled={pending} aria-busy={pending} className="btn-secondary inline-flex items-center gap-2 text-sm">
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
      {pending ? "Scanning…" : "Run scan now"}
    </button>
  );
}
