import { redirect } from "next/navigation";
import { auth } from "@/server/better-auth";
import { headers } from "next/headers";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    "use server";
    const response = await auth.api.signInSocial({
      headers: await headers(),
      body: {
        provider: "google",
        callbackURL: "/inbox",
      },
    });
    if (response.url) {
      redirect(response.url);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-base">
      {/* ── Deep gradient background ── */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950/80 via-bg-base to-bg-inset" />

      {/* ── Animated ambient orbs ── */}
      <div
        className="animate-pulse-subtle pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-indigo-600/20 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="animate-pulse-subtle pointer-events-none absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-violet-600/15 blur-[120px]"
        aria-hidden="true"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="animate-pulse-subtle pointer-events-none absolute left-1/3 top-2/3 h-64 w-64 rounded-full bg-blue-600/10 blur-[80px]"
        aria-hidden="true"
        style={{ animationDelay: "2s" }}
      />
      {/* Smaller accent orb */}
      <div
        className="animate-pulse-subtle pointer-events-none absolute -top-10 right-1/4 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-[90px]"
        aria-hidden="true"
        style={{ animationDelay: "3s" }}
      />

      {/* ── Login card ── */}
      <div className="animate-slide-up relative z-10 mx-4 w-full max-w-md">
        <div className="glass rounded-2xl px-8 py-12 shadow-xl sm:px-10 sm:py-14">
          {/* Logo */}
          <div className="flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <span className="text-3xl font-bold leading-none tracking-tight text-white">
                S
              </span>
            </div>

            {/* App name */}
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Singularity
            </h1>

            {/* Tagline */}
            <p className="mt-2 text-sm tracking-wide text-text-secondary sm:text-base">
              Email &amp; Calendar, Reimagined
            </p>
          </div>

          {/* Divider */}
          <div className="my-8 h-px w-full bg-gradient-to-r from-transparent via-border-default to-transparent" />

          {/* Sign-in form */}
          <form action={signInWithGoogle} className="flex flex-col gap-4">
            <button
              type="submit"
              className="group relative flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-medium text-gray-800 shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary active:translate-y-0 active:shadow-md"
            >
              {/* Google G icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </form>

          {/* Helper text */}
          <p className="mt-5 text-center text-xs text-text-tertiary">
            Connect your Gmail to get started
          </p>
        </div>

        {/* Subtle bottom glow under card */}
        <div
          className="pointer-events-none absolute -bottom-8 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-accent-primary/10 blur-[60px]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
