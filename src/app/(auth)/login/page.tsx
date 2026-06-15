"use client";

import { authClient } from "@/server/better-auth/client";
import Link from "next/link";

export default function LoginPage() {
  const signInWithGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/inbox",
    });
  };

  const handleDevLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
      });
      if (res.ok) {
        window.location.href = "/inbox";
      } else {
        alert("Dev login failed: " + (await res.text()));
      }
    } catch (err) {
      alert("Error logging in: " + err);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* ── Ambient background orbs ── */}
      <div className="animate-pulse-subtle pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-indigo-600/25 blur-[120px]" aria-hidden />
      <div
        className="animate-pulse-subtle pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]"
        aria-hidden
        style={{ animationDelay: "1.2s" }}
      />
      <div
        className="animate-pulse-subtle pointer-events-none absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-600/12 blur-[100px]"
        aria-hidden
        style={{ animationDelay: "2.5s" }}
      />

      {/* ── Back to home link ── */}
      <Link
        href="/"
        className="absolute left-6 top-6 flex items-center gap-2 text-xs text-white/40 transition-colors hover:text-white/70 md:left-10 md:top-8"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to home
      </Link>

      {/* ── Login card ── */}
      <div className="animate-slide-up relative z-10 mx-4 w-full max-w-md">
        {/* Card */}
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-8 py-12 shadow-2xl shadow-black/60 backdrop-blur-xl sm:px-10 sm:py-14"
        >
          {/* Corner glow inside card */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />

          {/* Logo */}
          <div className="relative flex flex-col items-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-2xl shadow-indigo-500/40">
              {/* Shimmer on logo */}
              <span className="absolute inset-0 animate-shimmer -skew-x-12 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span className="relative text-3xl font-bold leading-none tracking-tight text-white">
                S
              </span>
            </div>

            {/* App name */}
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Singularity
            </h1>

            {/* Tagline */}
            <p className="mt-2 text-sm tracking-wide text-white/45 sm:text-base">
              Email & Calendar, Reimagined
            </p>
          </div>

          {/* Divider */}
          <div className="my-8 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          {/* Sign-in prompt */}
          <p className="mb-6 text-center text-sm text-white/50">
            Sign in to access your unified workspace
          </p>

          {/* Google sign-in button */}
          <form onSubmit={signInWithGoogle} className="flex flex-col gap-4">
            <button
              type="submit"
              id="google-signin-btn"
              className="group relative flex w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-gray-800 shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 active:translate-y-0"
            >
              {/* Google G icon */}
              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
              <span className="animate-shimmer pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-black/5 to-transparent" />
            </button>
          </form>

          {/* Dev bypass (only in development) */}
          {process.env.NODE_ENV === "development" && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/25">dev only</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                id="dev-login-btn"
                onClick={handleDevLogin}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-3 text-sm font-medium text-indigo-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-500/20 hover:text-indigo-200 active:translate-y-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                Developer Bypass
              </button>
            </>
          )}

          {/* Helper text */}
          <p className="mt-6 text-center text-xs text-white/25">
            By signing in you agree to connect your Gmail & Google Calendar.
            <br />
            We only request the permissions we need.
          </p>
        </div>

        {/* Subtle bottom glow under card */}
        <div
          className="pointer-events-none absolute -bottom-8 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[60px]"
          aria-hidden
        />
      </div>
    </div>
  );
}
