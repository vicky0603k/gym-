"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * Install prompt component. Shown contextually after the first successful
 * check-in, never as a blocking popup on first load (DESIGN.md §7).
 * Different steps for Android Chrome vs iOS Safari.
 */
const SEEN_KEY = "install-prompt-dismissed";

export function InstallPrompt({ show }: { show: boolean }) {
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  // Starts hidden until storage is read, so a dismissed prompt never flashes.
  const [dismissed, setDismissedState] = useState(true);

  useEffect(() => {
    try {
      setDismissedState(localStorage.getItem(SEEN_KEY) === "1");
    } catch {
      setDismissedState(false);
    }
  }, []);

  const setDismissed = (value: boolean) => {
    setDismissedState(value);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private mode: the prompt may show again next time, which is harmless.
    }
  };

  if (!show || isInstalled || dismissed) return null;

  // iOS Safari doesn't support beforeinstallprompt — show manual instructions
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 rounded-lg bg-foreground p-4 text-background animate-slide-up">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden>
            <Share className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold mb-1">Add the gym app to your Home Screen</p>
            <p className="text-sm text-background/70 leading-relaxed">
              Tap Share, then &ldquo;Add to Home Screen&rdquo;. Next time, check in with one tap.
            </p>
          </div>
          <button
            className="-mr-2 -mt-2 flex h-12 w-12 items-center justify-center rounded-md hover:bg-background/10"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  if (!canPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-lg bg-foreground p-4 text-background animate-slide-up">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden>
          <Download className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold mb-1">Install the gym app</p>
          <p className="text-sm text-background/70">Opens straight to check-in, like any other app on your phone.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="min-h-[48px] rounded-lg font-medium text-background hover:bg-background/10" onClick={() => setDismissed(true)}>
          Not now
        </button>
        <button className="btn-primary" onClick={() => promptInstall().then(() => setDismissed(true))}>
          Install
        </button>
      </div>
    </div>
  );
}
