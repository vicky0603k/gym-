"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Check,
  CalendarX,
  CircleCheck,
  Clock,
  PauseCircle,
  QrCode,
  TimerOff,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { CheckInResult } from "@/services/attendance";
import { formatDisplayTime } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { InstallPrompt } from "@/components/install-prompt";
import { VisitSegments } from "@/components/ui/bits";

type Screen = { icon: LucideIcon; tone: string; title: string; message: string; scanAgain?: boolean };

const FRONT_DESK = "Please speak to the front desk.";

function screenFor(result: CheckInResult | "offline"): Screen {
  if (result === "offline") {
    return {
      icon: WifiOff,
      tone: "text-warning",
      title: "No internet",
      message: "Your check-in was not recorded. Ask the front desk for an assisted check-in.",
    };
  }
  if (result.ok) {
    return { icon: CircleCheck, tone: "text-success", title: "You're checked in", message: `Checked in at ${formatDisplayTime(result.checkinAt)}.` };
  }
  const { code, message } = result.error;
  switch (code) {
    case "DUPLICATE_CHECKIN":
      return { icon: Clock, tone: "text-foreground", title: "Already checked in", message };
    case "QR_EXPIRED":
      return { icon: TimerOff, tone: "text-warning", title: "QR expired", message, scanAgain: true };
    case "QR_INVALID":
      return { icon: QrCode, tone: "text-warning", title: "Not the gym QR", message, scanAgain: true };
    case "MEMBERSHIP_EXPIRED":
      return { icon: CalendarX, tone: "text-danger", title: "Membership expired", message };
    case "MEMBERSHIP_PAUSED":
      return { icon: PauseCircle, tone: "text-warning", title: "Membership paused", message };
    case "MEMBER_BLOCKED":
    case "MEMBER_CANCELLED":
      return { icon: Ban, tone: "text-danger", title: "Can't check in", message };
    default:
      return { icon: AlertTriangle, tone: "text-danger", title: "Check-in failed", message: `${message} ${FRONT_DESK}`, scanAgain: true };
  }
}

/** Full-screen result: icon, one-line message, next action. */
export function CheckInResultScreen({ result, onScanAgain }: { result: CheckInResult | "offline"; onScanAgain: () => void }) {
  const s = screenFor(result);
  const expired = result !== "offline" && !result.ok && result.error.code === "MEMBERSHIP_EXPIRED" ? result.error : null;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 text-center animate-fade-in" role="status">
      {result !== "offline" && result.ok ? (
        // Success is the one big volt moment: a filled disc with a black tick (volt is never a thin line on white).
        <span className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden>
          <Check className="h-12 w-12" strokeWidth={3} />
        </span>
      ) : (
        <s.icon className={cn("mb-5 h-20 w-20", s.tone)} aria-hidden />
      )}
      <h1 className="mb-2 text-2xl font-bold text-foreground">{s.title}</h1>
      <p className="max-w-xs text-base text-muted">{s.message}</p>

      {result !== "offline" && result.ok && (
        <div className="mt-6 w-full max-w-xs card p-4 text-left">
          <p className="text-sm text-muted">This week</p>
          <p className="mb-3 text-foreground">
            <span className="num-display text-5xl">{result.weeklyGoal.completed}</span>
            <span className="text-lg text-muted"> of {result.weeklyGoal.target} visits</span>
          </p>
          <VisitSegments done={result.weeklyGoal.completed} target={result.weeklyGoal.target} />
          {result.caseResolved && <p className="mt-2 text-sm font-semibold text-success">Welcome back — good to see you again!</p>}
        </div>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {expired && (
          <Link href="/member/renew" className="btn-primary">
            Renew now
          </Link>
        )}
        {s.scanAgain && (
          <button type="button" className="btn-primary" onClick={onScanAgain}>
            Scan again
          </button>
        )}
        <Link href="/member" className={s.scanAgain || expired ? "btn-secondary" : "btn-primary"}>
          {result !== "offline" && result.ok ? "Done" : "Back to home"}
        </Link>
      </div>
      <InstallPrompt show={result !== "offline" && result.ok} />
    </div>
  );
}
