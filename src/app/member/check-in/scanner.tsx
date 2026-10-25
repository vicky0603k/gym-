"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import type { CheckInResult } from "@/services/attendance";
import { checkInAction } from "./actions";
import { CheckInResultScreen } from "./check-in-result";

type State =
  | { kind: "idle" }
  | { kind: "starting" | "scanning" | "submitting" }
  | { kind: "camera-error"; denied: boolean }
  | { kind: "result"; result: CheckInResult | "offline" };

const READER_ID = "qr-reader";

/** Camera QR scanner → check-in server action → full-screen result. */
export function Scanner() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const scanner = useRef<Html5Qrcode | null>(null);
  const handled = useRef(false);
  const busy = useRef(false); // one camera start at a time (double effects, double taps)

  const stopCamera = useCallback(async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s?.isScanning) await s.stop().catch(() => undefined);
  }, []);

  const onDecoded = useCallback(
    async (text: string) => {
      if (handled.current) return; // the decoder fires repeatedly for one QR
      handled.current = true;
      await stopCamera();
      setState({ kind: "submitting" });
      try {
        setState({ kind: "result", result: await checkInAction(text) });
      } catch {
        setState({ kind: "result", result: "offline" });
      }
    },
    [stopCamera]
  );

  const start = useCallback(async () => {
    if (busy.current || scanner.current) return;
    busy.current = true;
    handled.current = false;
    setState({ kind: "starting" });
    // Let React un-hide the reader first: html5-qrcode sizes the scan box from its width.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const s = new Html5Qrcode(READER_ID, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
        onDecoded,
        () => undefined // "no QR in this frame" — expected constantly while aiming
      );
      setState({ kind: "scanning" });
    } catch (err) {
      scanner.current = null;
      const text = String(err);
      setState({ kind: "camera-error", denied: /NotAllowed|Permission|denied/i.test(text) });
    } finally {
      busy.current = false;
    }
  }, [onDecoded]);

  // Start straight away when camera permission was already granted (one tap less).
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((p) => {
        if (p.state === "granted") start();
      })
      .catch(() => undefined);
    return () => {
      stopCamera();
    };
  }, [start, stopCamera]);

  const live = state.kind === "starting" || state.kind === "scanning";
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
      {state.kind === "result" ? (
        <CheckInResultScreen result={state.result} onScanAgain={start} />
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Check in</h1>
          <p className="text-muted mb-5">Point your camera at the QR on the screen at the gym gate.</p>
        </>
      )}

      {/* html5-qrcode renders the video into this element, so it stays mounted in every state. */}
      <div
        id={READER_ID}
        className={live ? "overflow-hidden rounded-lg border border-border bg-foreground aspect-square" : "hidden"}
      />

      {state.kind === "idle" && (
        <div className="card p-5 text-center">
          <Camera className="mx-auto mb-3 h-10 w-10 text-foreground" aria-hidden />
          <p className="text-foreground mb-1">Camera access is needed to scan the gate QR.</p>
          <p className="text-sm text-muted mb-5">Your browser will ask once. The camera is used only while this screen is open.</p>
          <button type="button" className="btn-primary w-full" onClick={start}>
            Allow camera and scan
          </button>
        </div>
      )}

      {state.kind === "starting" && <p className="mt-4 text-center text-sm text-muted">Starting camera…</p>}
      {state.kind === "scanning" && (
        <p className="mt-4 text-center text-sm text-muted">Hold steady — the QR is read automatically.</p>
      )}

      {state.kind === "submitting" && (
        <div className="flex flex-col items-center py-16 text-center" role="status">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-foreground" aria-hidden />
          <p className="text-foreground">Checking you in…</p>
        </div>
      )}

      {state.kind === "camera-error" && (
        <div className="card p-5 text-center" role="alert">
          <CameraOff className="mx-auto mb-3 h-10 w-10 text-warning" aria-hidden />
          <p className="font-semibold text-foreground mb-1">
            {state.denied ? "Camera access was blocked" : "The camera couldn't start"}
          </p>
          <p className="text-sm text-muted mb-5">
            {state.denied
              ? "Ask the front desk for an assisted check-in. To scan next time, allow camera access for this site in your browser settings."
              : "Close other apps using the camera and try again, or ask the front desk for an assisted check-in."}
          </p>
          <button type="button" className="btn-secondary w-full" onClick={start}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
