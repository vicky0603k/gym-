"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { RotateCw, ScanLine, X } from "lucide-react";
import { QR_ROTATION_SECONDS } from "@/utils/constants";

type Current = { image: string; deadline: number; rotation: number };

/**
 * Full-screen gate QR. Fetches a fresh signed token at every rotation and
 * hides the QR the moment its step ends, so a stale code is never shown as valid.
 */
export function GateQr() {
  const [current, setCurrent] = useState<Current | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const res = await fetch("/api/qr-token", { cache: "no-store" });
      if (res.status === 401) throw new Error("Your session has ended. Log in again to show the gate QR.");
      if (!res.ok) throw new Error("The gate QR couldn't be created. Check the server settings and try again.");
      const body: { token: string; expires_in_seconds: number; rotation_seconds?: number } = await res.json();
      const image = await QRCode.toDataURL(body.token, { width: 720, margin: 2, errorCorrectionLevel: "M" });
      setCurrent({
        image,
        deadline: Date.now() + body.expires_in_seconds * 1000,
        rotation: body.rotation_seconds ?? QR_ROTATION_SECONDS,
      });
      setError(null);
    } catch (e) {
      setCurrent(null);
      setError(
        e instanceof TypeError
          ? "No internet connection. The QR will come back when the connection does."
          : e instanceof Error ? e.message : "Something went wrong."
      );
    } finally {
      loading.current = false;
    }
  }, []);

  // First load, a 250 ms clock, refresh at each deadline, and retry every 5 s after an error.
  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [load]);
  useEffect(() => {
    if (current && now >= current.deadline) load();
  }, [now, current, load]);
  useEffect(() => {
    if (!error) return;
    const retry = setInterval(load, 5000);
    return () => clearInterval(retry);
  }, [error, load]);

  // Keep the gate screen awake where the browser supports it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    const request = () =>
      (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => undefined);
    const onVisible = () => document.visibilityState === "visible" && request();
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, []);

  const valid = current && now < current.deadline;
  const secondsLeft = valid ? Math.ceil((current.deadline - now) / 1000) : 0;
  const fraction = valid ? (current.deadline - now) / (current.rotation * 1000) : 0;
  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-4">
      <Link
        href="/owner"
        className="btn-ghost absolute right-3 top-3 inline-flex items-center gap-2 text-muted"
        aria-label="Close gate QR"
      >
        <X className="h-5 w-5" aria-hidden /> Close
      </Link>

      <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground md:text-4xl">
        <ScanLine className="h-8 w-8 text-foreground md:h-10 md:w-10" aria-hidden /> Scan to check in
      </h1>

      <div className="flex aspect-square w-[min(82vw,62vh,640px)] items-center justify-center rounded-lg border-2 border-foreground bg-background p-3">
        {valid ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL generated on the device
          <img src={current.image} alt="Gate check-in QR code" className="h-full w-full" />
        ) : error ? (
          <div className="px-6 text-center text-base text-foreground">
            <p className="mb-4 font-semibold">{error}</p>
            <button type="button" onClick={load} className="btn-primary inline-flex items-center gap-2">
              <RotateCw className="h-4 w-4" aria-hidden /> Retry
            </button>
          </div>
        ) : (
          <div className="h-full w-full animate-pulse rounded-md bg-surface-2" aria-label="Loading QR" />
        )}
      </div>

      <div className="flex items-center gap-4" aria-live="polite">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="-rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" strokeWidth="6" className="stroke-surface-2" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            className={secondsLeft <= 5 ? "stroke-warning" : "stroke-foreground"}
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>
        <p className="text-xl text-muted md:text-2xl">
          {valid ? (
            <>
              New code in <span className="font-bold tabular-nums text-foreground">{secondsLeft}s</span>
            </>
          ) : error ? (
            "QR unavailable"
          ) : (
            "Getting a fresh code…"
          )}
        </p>
      </div>
      <p className="max-w-md text-center text-sm text-muted">
        Members open the app, tap Check-in and point the camera here. Screenshots stop working within 90 seconds.
      </p>
    </div>
  );
}
