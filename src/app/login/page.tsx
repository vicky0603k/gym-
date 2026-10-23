"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Shared login entry. Two modes:
 *   - Owner/Staff: email + password (Supabase Auth)
 *   - Member: phone + 4-digit PIN
 *
 * Module 1 shell — auth logic comes in Module 2.
 */
export default function LoginPage() {
  const [tab, setTab] = useState<"member" | "staff">("member");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
          <button
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              tab === "member"
                ? "bg-accent text-accent-foreground"
                : "text-muted"
            }`}
            onClick={() => setTab("member")}
          >
            Member
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              tab === "staff"
                ? "bg-accent text-accent-foreground"
                : "text-muted"
            }`}
            onClick={() => setTab("staff")}
          >
            Owner / Staff
          </button>
        </div>

        {tab === "member" ? (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="label" htmlFor="phone">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <label className="label" htmlFor="pin">
                4-digit PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                className="input"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Check In
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="owner@gym.demo"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Login to Dashboard
            </button>
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

        <p className="mt-4 text-xs text-muted text-center">
          Demo members: phone 9000020001–0030, PIN 1234
        </p>
      </div>
    </div>
  );
}
