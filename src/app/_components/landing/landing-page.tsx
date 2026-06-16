"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme-provider";

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
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Calendar Workflow",
    desc: "See your schedule at a glance. No tab-switching, no context loss — just flow.",
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
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
    title: "Smart Compose",
    desc: "Write better emails faster. Describe what you need and let the AI compose it for you.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Instant Actions",
    desc: "Reply, forward, archive or schedule — all from a single keystroke or a voice command.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Privacy First",
    desc: "Your data never leaves your Google account. We operate strictly within OAuth scopes.",
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
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  // Stats Counters
  const stat1 = useCountUp(10, 1600, "x");
  const stat2 = useCountUp(98, 1800, "%");
  const stat3 = useCountUp(60, 1400, "%");

  // Interactive mockup states
  const [activeTab, setActiveTab] = useState<"inbox" | "calendar">("inbox");
  const [selectedEmail, setSelectedEmail] = useState(0);
  const [aiDraftState, setAiDraftState] = useState<"idle" | "typing" | "done">("idle");
  const [aiText, setAiText] = useState("");
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const mockEmails = [
    {
      from: "GitHub",
      subj: "Your deployment is ready",
      unread: true,
      time: "2m",
      body: "Your project singularity is live on production! All 14 checks passed successfully. Click to inspect log details.",
      aiReply: "Thanks for the notification. The logs look pristine, and we are seeing great performance. Keep up the excellent work!"
    },
    {
      from: "Notion Support",
      subj: "Weekly workspace digest",
      unread: true,
      time: "1h",
      body: "Here are updates from your workspace. 12 pages modified by Team Singularity. Key updates: 'Landing page redesign proposal'.",
      aiReply: "Got the updates! Thanks for compiles. I will review the proposal before Q3 planning."
    },
    {
      from: "Linear",
      subj: "Issue SNG-142 resolved",
      unread: false,
      time: "3h",
      body: "Closed by lead developer. Summary: Fix agent multi-choice button compatibility and reasoning log structures.",
      aiReply: "Excellent work on this fix. The reasoning log fix is resolving our API latency perfectly."
    },
    {
      from: "Dev Team",
      subj: "Re: Q3 planning — next steps",
      unread: false,
      time: "5h",
      body: "Should we schedule the planning meeting for Tuesday morning? I can send over the Agenda doc.",
      aiReply: "Tuesday morning works perfect. Send over the agenda document and I will add it to the calendar."
    }
  ];

  // Trigger typing effect for the active email reply
  const triggerAiDraft = (emailIndex: number) => {
    if (typingTimer.current) clearInterval(typingTimer.current);
    setAiDraftState("typing");
    setAiText("");
    const targetText = mockEmails[emailIndex]?.aiReply ?? "";
    let i = 0;
    
    typingTimer.current = setInterval(() => {
      if (i < targetText.length) {
        setAiText((prev) => prev + targetText.charAt(i));
        i++;
      } else {
        if (typingTimer.current) clearInterval(typingTimer.current);
        setAiDraftState("done");
      }
    }, 25);
  };

  useEffect(() => {
    setAiDraftState("idle");
    setAiText("");
  }, [selectedEmail]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg-base text-text-primary transition-colors duration-300">
      
      {/* ══════════════════ GLOBAL BG MESH (Monochrome subtle glow matching the site) ══════════════════ */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-border-default/15 dark:bg-border-default/8 blur-[130px] animate-pulse-subtle" />
        <div className="absolute -right-40 top-10 h-[500px] w-[500px] rounded-full bg-border-default/10 dark:bg-border-default/5 blur-[120px] animate-pulse-subtle" style={{ animationDelay: "1.2s" }} />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-border-subtle/20 dark:bg-border-subtle/10 blur-[150px] animate-pulse-subtle" style={{ animationDelay: "2.5s" }} />
      </div>

      {/* ══════════════════ STICKY GLASS NAVBAR ══════════════════ */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 border-b ${
        scrolled 
          ? "bg-bg-raised/75 backdrop-blur-md py-4 border-border-default shadow-sm" 
          : "bg-transparent py-5 border-transparent"
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-12 lg:px-20">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 overflow-hidden items-center justify-center rounded-xl bg-accent-primary text-text-inverse shadow-sm">
              <img src="/logo.png" alt="Singularity Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-text-primary">
              Singularity
            </span>
          </div>

          {/* Links */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              How it works
            </a>
            <a href="#stats" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              Metrics
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            
            {/* Smooth Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-bg-raised text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-200"
            >
              {theme === "dark" ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M5.25 5.25l1.591 1.591M17.159 17.159l1.591 1.591M3 12h2.25m13.5 0H21M5.25 18.75l1.591-1.591M17.159 6.841l1.591-1.591m-4.75 5.159a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
            </button>

            <Link
              href="/login"
              className="rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-text-inverse shadow-sm hover:bg-accent-primary-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════ HERO SECTION ══════════════════ */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-12 pt-32 text-center md:pt-40 lg:pt-48">
        
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-semibold tracking-wide text-text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-secondary" />
          Mail & Calendar Workflow, Unified
        </div>

        {/* Headline */}
        <h1 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
          Singularity is your{" "}
          <br className="hidden md:inline" />
          <span className="bg-gradient-to-r from-text-primary via-text-secondary to-text-primary bg-clip-text text-transparent">
            workflow in one place
          </span>
        </h1>

        {/* Description */}
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg">
          No more switching tabs between your email inbox and calendar. Singularity merges 
          your Gmail messages and Google Calendar events into a single, elegant workspace powered by an AI Co-Pilot.
        </p>

        {/* Hero CTA buttons */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/login"
            id="hero-cta-primary"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-accent-primary px-8 py-4 text-base font-semibold text-text-inverse shadow-sm hover:bg-accent-primary-hover hover:-translate-y-0.5 transition-all duration-200"
          >
            <span>Connect your Gmail</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <a
            href="#features"
            id="hero-cta-secondary"
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-raised px-8 py-4 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface hover:-translate-y-0.5 transition-all duration-200"
          >
            Explore features
          </a>
        </div>

        {/* Helper Caption */}
        <p className="mt-6 text-xs text-text-tertiary">
          Secure OAuth connection · Free access · No credit card
        </p>

        {/* ══════════════════ INTERACTIVE DEMO ══════════════════ */}
        <div className="relative mt-16 w-full max-w-5xl">
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-3xl bg-border-default/10 blur-3xl" />
          
          {/* Main Mockup container */}
          <div className="relative overflow-hidden rounded-2xl border border-border-default bg-bg-raised shadow-xl transition-all duration-300">
            
            {/* Browser window chrome */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-border-default" />
                <span className="h-3 w-3 rounded-full bg-border-default" />
                <span className="h-3 w-3 rounded-full bg-border-default" />
                <span className="ml-3 text-xs font-medium text-text-tertiary">singularity.app/workspace</span>
              </div>

              {/* View / Tab Switcher */}
              <div className="flex items-center rounded-lg bg-bg-base p-1 border border-border-subtle">
                <button
                  onClick={() => { setActiveTab("inbox"); }}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                    activeTab === "inbox" 
                      ? "bg-bg-raised text-text-primary shadow-xs" 
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Gmail Inbox
                </button>
                <button
                  onClick={() => { setActiveTab("calendar"); }}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                    activeTab === "calendar" 
                      ? "bg-bg-raised text-text-primary shadow-xs" 
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Calendar View
                </button>
              </div>
            </div>

            {/* Simulated app workspace */}
            <div className="flex h-[460px] w-full bg-bg-base text-left">
              
              {/* Mockup Sidebar */}
              <div className="hidden w-52 flex-col border-r border-border-subtle bg-bg-raised p-4 sm:flex">
                <div className="mb-6 flex items-center gap-2 px-2">
                  <div className="h-6 w-6 rounded bg-bg-surface border border-border-default flex items-center justify-center text-text-primary font-bold">
                    S
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Workspace</span>
                </div>

                <div className="space-y-1">
                  {[
                    { label: "Inbox", icon: "📥", tab: "inbox" },
                    { label: "Calendar", icon: "📅", tab: "calendar" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { setActiveTab(item.tab as "inbox" | "calendar"); }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                        activeTab === item.tab 
                          ? "bg-bg-surface text-text-primary border border-border-default shadow-xs" 
                          : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                  <div className="pt-4 pb-2 px-3 text-[10px] font-bold tracking-wider text-text-tertiary uppercase">AI assistant</div>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-text-secondary hover:bg-bg-surface hover:text-text-primary">
                    <span>✨</span>
                    <span>AI Chat</span>
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-text-secondary hover:bg-bg-surface hover:text-text-primary">
                    <span>⚙️</span>
                    <span>Settings</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC CONTENT CONTAINER */}
              {activeTab === "inbox" ? (
                <>
                  {/* Email List Column */}
                  <div className="flex w-full flex-col border-r border-border-subtle bg-bg-raised md:w-80">
                    <div className="border-b border-border-subtle px-4 py-3.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary">Primary Inbox</span>
                      <span className="rounded bg-bg-surface border border-border-default px-2 py-0.5 text-[10px] font-semibold text-text-primary">2 unread</span>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50">
                      {mockEmails.map((email, idx) => (
                        <div
                          key={idx}
                          onClick={() => { setSelectedEmail(idx); }}
                          className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                            selectedEmail === idx 
                              ? "bg-bg-surface border-l-2 border-accent-primary" 
                              : "hover:bg-bg-surface/50"
                          }`}
                        >
                          <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-border-default text-xs font-bold text-text-primary`}>
                            {email.from[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`truncate text-xs ${email.unread ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                                {email.from}
                              </span>
                              <span className="text-[10px] text-text-tertiary">{email.time}</span>
                            </div>
                            <span className={`block truncate text-xs ${email.unread ? "text-text-secondary font-medium" : "text-text-tertiary"}`}>
                              {email.subj}
                            </span>
                          </div>
                          {email.unread && (
                            <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Details + AI replies */}
                  <div className="hidden flex-1 flex-col bg-bg-base p-5 md:flex">
                    {/* Header */}
                    <div className="border-b border-border-subtle pb-4">
                      <h3 className="text-sm font-bold text-text-primary">{mockEmails[selectedEmail]?.subj}</h3>
                      <p className="text-xs text-text-secondary mt-1">From: <span className="font-semibold">{mockEmails[selectedEmail]?.from}</span></p>
                    </div>

                    {/* Body */}
                    <div className="flex-1 py-4 text-xs text-text-secondary leading-relaxed overflow-y-auto">
                      {mockEmails[selectedEmail]?.body}
                    </div>

                    {/* Dynamic AI Co-Pilot block */}
                    <div className="rounded-xl border border-border-default bg-bg-raised p-4 shadow-sm">
                      <div className="flex items-center justify-between pb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-text-primary">✨ AI Smart Reply</span>
                        </div>

                        {aiDraftState === "idle" && (
                          <button
                            onClick={() => triggerAiDraft(selectedEmail)}
                            className="rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-semibold text-text-inverse hover:bg-accent-primary-hover transition-colors"
                          >
                            Draft Reply
                          </button>
                        )}
                      </div>

                      {aiDraftState !== "idle" && (
                        <div className="rounded-lg bg-bg-surface p-3 border border-border-subtle text-xs text-text-primary min-h-[50px] font-sans">
                          {aiText}
                          {aiDraftState === "typing" && (
                            <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-accent-primary animate-pulse align-middle" />
                          )}
                        </div>
                      )}

                      {aiDraftState === "done" && (
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-[10px] text-accent-success font-semibold flex items-center gap-1">
                            ✓ Ready to send
                          </span>
                          <button 
                            onClick={() => setAiDraftState("idle")} 
                            className="text-[10px] text-text-tertiary hover:text-text-primary font-medium"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                // CALENDAR WORKFLOW VIEW
                <div className="flex w-full flex-col bg-bg-raised p-6 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">Google Calendar</h3>
                      <p className="text-xs text-text-tertiary">Unified daily schedule</p>
                    </div>
                    <span className="rounded bg-bg-surface border border-border-default px-3 py-1 text-xs font-bold text-text-primary">
                      Tuesday, Jun 16
                    </span>
                  </div>

                  {/* Hourly mock blocks */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-3">
                    {[
                      { time: "09:00 AM", event: "Weekly Development Alignment", tag: "Calendar", color: "border-text-secondary bg-bg-surface/50 text-text-primary" },
                      { time: "11:00 AM", event: "Client Feedback Call", tag: "Email Invite Sync", color: "border-text-primary bg-bg-surface text-text-primary" },
                      { time: "12:30 PM", event: "Team Lunch & Sync", tag: "Calendar", color: "border-text-secondary bg-bg-surface/50 text-text-primary" },
                      { time: "02:00 PM", event: "Deep Work: Landing Page builds", tag: "Focus Time", color: "border-text-primary bg-bg-surface text-text-primary font-semibold" },
                    ].map((item, idx) => (
                      <div key={idx} className={`flex items-start gap-4 rounded-xl border-l-4 p-3 shadow-xs ${item.color} border-border-default`}>
                        <div className="w-20 text-xs font-bold opacity-80">{item.time}</div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold">{item.event}</h4>
                          <span className="inline-block mt-1 rounded bg-bg-raised px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-text-secondary border border-border-default">
                            {item.tag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
          
          <div className="mt-4 text-center text-xs text-text-tertiary italic">
            💡 Switch tabs or select emails to test the workflow demo!
          </div>
        </div>
      </section>

      {/* ══════════════════ STATS / METRICS SECTION ══════════════════ */}
      <section id="stats" className="relative z-10 mx-auto mt-24 max-w-4xl px-6 md:px-12">
        <div className="grid grid-cols-1 divide-y divide-border-subtle/80 overflow-hidden rounded-2xl border border-border-default bg-bg-raised shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { value: stat1, label: "Triage Speedup with AI" },
            { value: stat2, label: "Tab-Switch Reduction" },
            { value: stat3, label: "Writing Overhead Saved" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center px-8 py-10">
              <span
                ref={value.ref}
                className="bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-5xl font-extrabold text-transparent"
              >
                {value.display}
              </span>
              <span className="mt-2 text-center text-sm font-semibold text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ FEATURES GRID ══════════════════ */}
      <section id="features" className="relative z-10 mx-auto mt-32 max-w-7xl px-6 md:px-12 lg:px-20">
        
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-bold text-text-primary">
            Work Smarter
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
            Fusing mail and calendar into{" "}
            <span className="bg-gradient-to-r from-text-primary via-text-secondary to-text-primary bg-clip-text text-transparent">
              one seamless workflow
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-text-secondary">
            Never click back-and-forth between tabs again. Live, track, and draft with high performance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border-default bg-bg-raised p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-accent-primary hover:shadow-lg"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-bg-surface border border-border-default text-text-primary shadow-xs">
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-bold text-text-primary">{f.title}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="how-it-works" className="relative z-10 mx-auto mt-32 max-w-4xl px-6 md:px-12">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-bold text-text-primary">
            Frictionless Setup
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Get started in 3 simple steps
          </h2>
        </div>

        <div className="relative space-y-6">
          <div className="absolute left-6 top-8 h-[calc(100%-4rem)] w-px bg-border-default" />

          {[
            {
              step: "01",
              title: "Connect your Google account",
              desc: "Quickly sign in with Google. We request secure OAuth access exclusively for email and calendar functionalities.",
            },
            {
              step: "02",
              title: "Sync inbox and calendar",
              desc: "Singularity instantly populates your primary mail threads, drafts, sent messages, and upcoming schedule events.",
            },
            {
              step: "03",
              title: "Command with AI Co-Pilot",
              desc: "Draft replies, write, schedule, or read digests in seconds using inline AI agent capabilities.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="relative flex items-start gap-6">
              <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent-primary text-sm font-bold text-text-inverse shadow-sm">
                {step}
              </div>
              <div className="rounded-2xl border border-border-default bg-bg-raised p-5 shadow-xs flex-1">
                <h3 className="mb-1.5 text-sm font-bold text-text-primary">{title}</h3>
                <p className="text-xs leading-relaxed text-text-secondary">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ CTA CARD ══════════════════ */}
      <section className="relative z-10 mx-auto mt-32 max-w-4xl px-6 pb-32 md:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-border-default bg-bg-raised p-12 text-center shadow-md">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-border-default/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-border-subtle/10 blur-3xl" />

          <h2 className="relative text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Reclaim your focus.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-sm text-text-secondary leading-relaxed">
            Unify your communication hub today. Experience next-generation productivity with Singularity.
          </p>

          <div className="relative mt-8 flex justify-center">
            <Link
              href="/login"
              id="cta-final-btn"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-accent-primary px-8 py-4 text-base font-semibold text-text-inverse shadow-md hover:bg-accent-primary-hover hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Get started for free</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="relative z-10 border-t border-border-subtle bg-bg-raised px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 overflow-hidden items-center justify-center rounded-lg bg-accent-primary text-text-inverse">
              <img src="/logo.png" alt="Singularity Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Singularity</span>
          </div>
          <p className="text-xs text-text-tertiary">
            © {new Date().getFullYear()} Singularity. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
