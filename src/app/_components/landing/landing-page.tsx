"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────
   Feature cards data
───────────────────────────────────────── */
const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    title: "Unified Inbox",
    desc: "All your Gmail threads in one place. Sent, Drafts, everything — beautifully organised.",
    color: "from-indigo-500 to-violet-600",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Calendar Workflow",
    desc: "See your schedule at a glance. No tab-switching, no context loss — just flow.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    title: "AI Co-Pilot",
    desc: "Draft emails, summarise threads, and automate actions with a powerful AI agent built in.",
    color: "from-fuchsia-500 to-pink-600",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
    title: "Smart Compose",
    desc: "Write better emails faster. Describe what you need and let the AI compose it for you.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Instant Actions",
    desc: "Reply, forward, archive or schedule — all from a single keystroke or a voice command.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Privacy First",
    desc: "Your data never leaves your Google account. We operate strictly within OAuth scopes.",
    color: "from-emerald-500 to-teal-600",
  },
];

/* ─────────────────────────────────────────
   Animated counter hook
───────────────────────────────────────── */
function useCountUp(target: number, duration = 1800, suffix = "") {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        let start = 0;
        const step = (timestamp: number) => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / duration, 1);
          setCount(Math.floor(progress * target));
          if (progress < 1) requestAnimationFrame(step);
          else setCount(target);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return { ref, display: `${count}${suffix}` };
}

/* ─────────────────────────────────────────
   Main Landing Component
───────────────────────────────────────── */
export default function LandingPage() {
  const stat1 = useCountUp(10, 1600, "x");
  const stat2 = useCountUp(98, 1800, "%");
  const stat3 = useCountUp(60, 1400, "%");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0a0f] text-white">
      {/* ══════════════════ GLOBAL BG MESH ══════════════════ */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* top-left blob */}
        <div className="animate-pulse-subtle absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-indigo-600/20 blur-[160px]" />
        {/* top-right blob */}
        <div
          className="animate-pulse-subtle absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[140px]"
          style={{ animationDelay: "1.2s" }}
        />
        {/* center accent */}
        <div
          className="animate-pulse-subtle absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-[180px]"
          style={{ animationDelay: "2.5s" }}
        />
        {/* bottom blob */}
        <div
          className="animate-pulse-subtle absolute -bottom-40 left-1/4 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[160px]"
          style={{ animationDelay: "0.8s" }}
        />
      </div>

      {/* ══════════════════ NAVBAR ══════════════════ */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12 lg:px-20">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/30">
            <span className="text-lg font-bold leading-none text-white">S</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            Singularity
          </span>
        </div>

        {/* Nav links */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-white/60 transition-colors hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-white/60 transition-colors hover:text-white">
            How it works
          </a>
          <a href="#stats" className="text-sm text-white/60 transition-colors hover:text-white">
            Why Singularity
          </a>
        </div>

        {/* CTA */}
        <Link
          href="/login"
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-indigo-500/40 active:translate-y-0"
        >
          Get Started Free
        </Link>
      </nav>

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-10 pt-20 text-center md:pt-28 lg:pt-36">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
          Your entire communication workflow — one place
        </div>

        {/* Headline */}
        <h1 className="max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
          Email & Calendar,{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Reimagined
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
          Singularity fuses your Gmail inbox with your Google Calendar into one
          fluid, AI-powered workspace. Stop switching tabs. Start getting things done.
        </p>

        {/* CTA row */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/login"
            id="hero-cta-primary"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-indigo-500/50"
          >
            <span>Connect your Gmail</span>
            <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            {/* Shimmer overlay */}
            <span className="animate-shimmer absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </Link>
          <a
            href="#features"
            id="hero-cta-secondary"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-base font-medium text-white/80 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            See features
          </a>
        </div>

        {/* Social proof strip */}
        <p className="mt-8 text-xs text-white/30">
          Free forever · No credit card required · Works with any Gmail account
        </p>

        {/* Hero image */}
        <div className="relative mt-20 w-full max-w-5xl">
          {/* Glow behind image */}
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-3xl bg-gradient-to-b from-indigo-600/20 to-transparent blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/60 backdrop-blur-sm">
            {/* Fake window chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <span className="h-3 w-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-white/30">singularity.app/inbox</span>
            </div>
            {/* App preview — inline SVG mockup */}
            <div className="flex h-80 w-full md:h-[460px]">
              {/* Sidebar */}
              <div className="hidden w-56 flex-col border-r border-white/10 bg-white/3 p-4 md:flex">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-indigo-500/40" />
                  <div className="h-3 w-20 rounded bg-white/10" />
                </div>
                {["Inbox", "Sent", "Drafts", "Calendar", "AI Chat"].map((label, i) => (
                  <div
                    key={label}
                    className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 ${i === 0 ? "bg-indigo-500/20" : ""}`}
                  >
                    <div className="h-3 w-3 rounded-sm bg-white/20" />
                    <div
                      className="h-2.5 rounded"
                      style={{
                        width: `${60 + i * 8}px`,
                        background: i === 0 ? "rgba(129,140,248,0.6)" : "rgba(255,255,255,0.15)",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Email list */}
              <div className="flex w-full flex-col gap-0 overflow-hidden border-r border-white/10 md:w-80">
                <div className="border-b border-white/10 px-4 py-3">
                  <div className="h-5 w-24 rounded bg-white/15" />
                </div>
                {[
                  { from: "GitHub", subj: "Your deployment is ready", unread: true, time: "2m" },
                  { from: "Notion", subj: "Weekly digest — Jun 15", unread: true, time: "1h" },
                  { from: "Linear", subj: "Issue SNG-142 resolved", unread: false, time: "3h" },
                  { from: "Team", subj: "Re: Q3 planning — next steps", unread: false, time: "5h" },
                  { from: "Figma", subj: "Someone commented on your file", unread: false, time: "1d" },
                ].map((email, i) => (
                  <div
                    key={i}
                    className={`flex cursor-pointer items-start gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5 ${i === 0 ? "bg-indigo-500/10" : ""}`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-500/40 text-[10px] font-semibold text-white/80">
                      {email.from[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`truncate text-xs ${email.unread ? "font-semibold text-white/90" : "text-white/50"}`}>
                          {email.from}
                        </span>
                        <span className="ml-2 flex-shrink-0 text-[10px] text-white/30">{email.time}</span>
                      </div>
                      <div className={`mt-0.5 truncate text-[11px] ${email.unread ? "text-white/70" : "text-white/35"}`}>
                        {email.subj}
                      </div>
                    </div>
                    {email.unread && (
                      <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                    )}
                  </div>
                ))}
              </div>

              {/* AI chat panel */}
              <div className="hidden flex-1 flex-col p-4 lg:flex">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 p-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full text-white">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-white/60">AI Co-Pilot</span>
                </div>
                <div className="flex-1 space-y-3 overflow-hidden">
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-white/10 p-3 text-[11px] text-white/70">
                    Summarise the GitHub deployment email for me
                  </div>
                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600/70 to-violet-600/70 p-3 text-[11px] text-white/90">
                    Your deployment to production went live 2 minutes ago. All checks passed. <span className="text-indigo-200">View summary →</span>
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-white/10 p-3 text-[11px] text-white/70">
                    Draft a reply thanking the team
                  </div>
                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600/70 to-violet-600/70 p-3 text-[11px] text-white/90">
                    <span className="text-indigo-200">Drafting… </span>Thanks everyone for the quick turnaround on the deployment. Really appreciate the effort!
                  </div>
                </div>
                {/* Input bar */}
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="h-2.5 flex-1 rounded bg-white/10" />
                  <div className="h-6 w-6 rounded-lg bg-indigo-500/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ STATS ══════════════════ */}
      <section id="stats" className="relative z-10 mx-auto mt-24 max-w-4xl px-6 md:px-12">
        <div className="grid grid-cols-1 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { value: stat1, label: "Faster email triage with AI" },
            { value: stat2, label: "Reduction in tab-switching" },
            { value: stat3, label: "Less time writing replies" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center px-8 py-10">
              <span
                ref={value.ref}
                className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-5xl font-bold text-transparent"
              >
                {value.display}
              </span>
              <span className="mt-2 text-center text-sm text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section id="features" className="relative z-10 mx-auto mt-32 max-w-7xl px-6 md:px-12 lg:px-20">
        {/* Section header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300">
            Everything you need
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Built for people who{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              live in their inbox
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">
            Every feature in Singularity is designed around one idea — your time is precious.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/8 hover:shadow-2xl hover:shadow-black/40"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Icon */}
              <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg`}>
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{f.desc}</p>
              {/* Hover glow */}
              <div className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${f.color} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20`} />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="how-it-works" className="relative z-10 mx-auto mt-32 max-w-4xl px-6 md:px-12">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
            Get started in 60 seconds
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Three steps to{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              inbox zero
            </span>
          </h2>
        </div>

        <div className="relative space-y-6">
          {/* Vertical line */}
          <div className="absolute left-6 top-8 h-[calc(100%-4rem)] w-px bg-gradient-to-b from-indigo-500/50 via-violet-500/30 to-transparent" />

          {[
            {
              step: "01",
              title: "Connect your Google account",
              desc: "One click. We request only the Gmail and Calendar scopes we need — nothing more.",
              color: "from-indigo-500 to-violet-600",
            },
            {
              step: "02",
              title: "Your inbox loads instantly",
              desc: "Singularity fetches and intelligently organises your threads, labels, and calendar events in real time.",
              color: "from-violet-500 to-purple-600",
            },
            {
              step: "03",
              title: "Let the AI do the heavy lifting",
              desc: "Ask it to draft, summarise, schedule, or archive. The AI Co-Pilot handles the mundane so you can focus on what matters.",
              color: "from-fuchsia-500 to-pink-600",
            },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className="relative flex items-start gap-6 pl-0">
              {/* Step indicator */}
              <div className={`relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-sm font-bold text-white shadow-lg`}>
                {step}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <h3 className="mb-1.5 text-base font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ CTA SECTION ══════════════════ */}
      <section className="relative z-10 mx-auto mt-32 max-w-4xl px-6 pb-32 md:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-violet-950/60 to-purple-950/80 p-12 text-center backdrop-blur-xl">
          {/* Background orbs */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />

          <h2 className="relative text-4xl font-bold tracking-tight text-white md:text-5xl">
            Take back your{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              inbox
            </span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-white/55">
            Join people who have made Singularity their single source of truth for
            email and calendar. It only takes a minute to get started.
          </p>

          <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              id="cta-final-btn"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-indigo-600/50"
            >
              <span>Get started — it's free</span>
              <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span className="animate-shimmer absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            </Link>
          </div>

          <p className="relative mt-5 text-xs text-white/25">
            No credit card · No vendor lock-in · Cancel anytime
          </p>
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-sm font-medium text-white/60">Singularity</span>
          </div>
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Singularity. Your mail and calendar workflow, unified.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-xs text-white/40 transition-colors hover:text-white/70">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
