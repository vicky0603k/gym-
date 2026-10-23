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
export default function LoginPage() {
  const [tab, setTab] = useState<"member" | "staff">("member");
  const [memberState, memberAction] = useFormState(memberLoginAction, null);
  const [staffState, staffAction] = useFormState(staffLoginAction, null);
  const error = tab === "member" ? memberState?.ok === false && memberState.error : staffState?.ok === false && staffState.error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-black text-accent-foreground">F</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-surface rounded-lg p-1">
          {(["member", "staff"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              className={`flex-1 py-2 min-h-[44px] rounded-md text-sm font-semibold transition-colors ${
                tab === t ? "bg-accent text-accent-foreground" : "text-muted"
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

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back to home
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
