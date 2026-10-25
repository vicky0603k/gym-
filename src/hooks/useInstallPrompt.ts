"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Chrome fires this once per page load, usually before the member reaches the
// check-in success screen, so it is captured as soon as this module loads.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
}

/**
 * Custom install button state. The prompt is only shown once, after the
 * first successful check-in (per DESIGN.md §7).
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(deferred);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    const sync = () => setPromptEvent(deferred);
    const installed = () => setIsInstalled(true);
    listeners.add(sync);
    window.addEventListener("appinstalled", installed);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const promptInstall = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    deferred = null; // an event can be prompted only once
    setPromptEvent(null);
  };

  return {
    canPrompt: !!promptEvent && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
