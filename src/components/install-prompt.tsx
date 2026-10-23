"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * Install prompt component. Shown contextually after the first successful
 * check-in, never as a blocking popup on first load (DESIGN.md §7).
 * Different steps for Android Chrome vs iOS Safari.
 */
export function InstallPrompt({ show }: { show: boolean }) {
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!show || isInstalled || dismissed) return null;

  // iOS Safari doesn't support beforeinstallprompt — show manual instructions
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 card p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>📱</span>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm mb-1">
              Add to Home Screen
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Tap the Share button, then &ldquo;Add to Home Screen&rdquo; to
              install the app.
            </p>
          </div>
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (!canPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 card p-4 animate-slide-up">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>💪</span>
        <div className="flex-1">
          <p className="font-semibold text-foreground text-sm mb-1">
            Install the app
          </p>
          <p className="text-xs text-muted">
            Quick access to check-in and your fitness goals.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => setDismissed(true)}
          >
            Not now
          </button>
          <button
            className="btn-primary text-xs px-4 py-2"
            onClick={promptInstall}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
