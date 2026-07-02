"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Reveal } from "@/components/motion/Reveal";
import { SiteHeader } from "@/components/ui/SiteHeader";

type Mode = "signin" | "signup";

type Props = {
  mode: Mode;
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create your account" : "Welcome back";
  const subtitle = isSignup
    ? "Sign up with Google or verify your email with a one-time code."
    : "Sign in with Google or your email OTP.";

  async function sendOtp() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevOtp(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const message = Array.isArray(detail) ? detail[0]?.msg : detail;
        throw new Error(message || "Could not send verification code.");
      }
      setStep("otp");
      setMessage(data.message || "Check your inbox for the code.");
      if (data.dev_otp) setDevOtp(data.dev_otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const message = Array.isArray(detail) ? detail[0]?.msg : detail;
        throw new Error(message || "Invalid verification code.");
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn(credential: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id_token: credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const message = Array.isArray(detail) ? detail[0]?.msg : detail;
        throw new Error(message || "Google sign-in failed.");
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-grid-bg flex min-h-screen flex-col">
      <SiteHeader showNav={false} />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <Reveal immediate delay={1}>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
            </Reveal>
            <Reveal immediate delay={2}>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>
            </Reveal>
          </div>

        <Reveal immediate delay={4}>
          <div className="glass-panel space-y-5 rounded-2xl p-6">
            <Reveal immediate delay={5}>
              <GoogleSignInButton onSuccess={googleSignIn} onError={setError} disabled={loading} />
            </Reveal>

            <Reveal immediate delay={6} className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">or email OTP</span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </Reveal>

            {step === "email" ? (
              <div key="email-step" className="ui-step-enter space-y-3">
                <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none ring-emerald-500/30 transition focus:border-emerald-500/40 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={loading}
                  className="btn-primary w-full !py-2.5"
                >
                  {loading ? "Sending…" : isSignup ? "Send sign-up code" : "Send sign-in code"}
                </button>
              </div>
            ) : (
              <div key="otp-step" className="ui-step-enter space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Code sent to <span className="font-medium text-[var(--text-secondary)]">{email}</span>
                </p>
                {devOtp ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-100">
                    Dev mode OTP: <span className="font-mono font-semibold">{devOtp}</span>
                  </p>
                ) : null}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-[var(--text-primary)] outline-none ring-emerald-500/30 transition focus:border-emerald-500/40 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => void verifyOtp()}
                  disabled={loading || code.length !== 6}
                  className="btn-primary w-full !py-2.5 disabled:opacity-60"
                >
                  {loading ? "Verifying…" : isSignup ? "Verify & create account" : "Verify & sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setDevOtp(null);
                  }}
                  className="w-full text-xs text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
                >
                  Use a different email
                </button>
              </div>
            )}

            {message ? <p className="text-xs text-emerald-600 dark:text-emerald-300">{message}</p> : null}
            {error ? <p className="text-xs text-rose-500">{error}</p> : null}
          </div>
        </Reveal>

        <Reveal immediate delay={7} className="text-center text-sm text-[var(--text-muted)]">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href={`/auth/signin?next=${encodeURIComponent(nextPath)}`} className="text-emerald-500 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`} className="text-emerald-500 hover:underline">
                Create an account
              </Link>
            </>
          )}
        </Reveal>
        </div>
      </div>
    </div>
  );
}
