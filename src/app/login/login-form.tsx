"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { memberLoginAction, staffLoginAction } from "./actions";

/**
 * Shared login entry. Two modes:
 *   - Owner/Staff: email + password (Supabase Auth)
 *   - Member: phone + 4-digit PIN
 * Inputs are re-validated with Zod on the server (services/auth.ts).
 */
export function LoginForm({ gymName }: { gymName: string }) {
  const [tab, setTab] = useState<"member" | "staff">("member");
  const [memberState, memberAction] = useFormState(memberLoginAction, null);
  const [staffState, staffAction] = useFormState(staffLoginAction, null);
  const error = tab === "member" ? memberState?.ok === false && memberState.error : staffState?.ok === false && staffState.error;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-foreground px-6 pb-10 pt-12 text-background">
        <div className="mx-auto w-full max-w-sm">
          <p className="text-sm text-background/70">Log in to</p>
          <h1 className="num-display mt-1 break-words text-5xl uppercase">{gymName}</h1>
        </div>
      </header>
      <div className="mx-auto -mt-5 w-full max-w-sm flex-1 px-4">
        {/* Who is logging in */}
        <div className="mb-6 flex gap-1 rounded-lg border border-border bg-background p-1 shadow-sm">
          {(["member", "staff"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              className={`min-h-[48px] flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                tab === t ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "member" ? "Member" : "Owner / Staff"}
            </button>
          ))}
        </div>

        {tab === "member" ? (
          <form key="member" action={memberAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="phone">
                Mobile number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                placeholder="10-digit mobile number"
                className="input"
                onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <label className="label" htmlFor="pin">
                4-digit PIN
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="••••"
                className="input"
                onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/\D/g, ""))}
              />
            </div>
            <ErrorMessage message={error ? error.message : null} />
            <SubmitButton label="Log in" />
            <p className="text-xs text-muted text-center">
              Forgot your PIN? Ask the front desk to reset it.
            </p>
          </form>
        ) : (
          <form key="staff" action={staffAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
            </div>
            <ErrorMessage message={error ? error.message : null} />
            <SubmitButton label="Log in to dashboard" />
          </form>
        )}

        <div className="mt-8 flex justify-center gap-6 pb-8 text-sm">
          <Link href="/gym" className="text-muted hover:text-foreground transition-colors">
            Gym plans &amp; timings
          </Link>
          <Link href="/privacy" className="text-muted hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Logging in…" : label}
    </button>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  return (
    <p role="alert" aria-live="assertive" className="text-sm text-danger empty:hidden">
      {message}
    </p>
  );
}
