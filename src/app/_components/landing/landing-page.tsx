"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme-provider";
import { authClient } from "@/server/better-auth/client";

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
    desc: "All your Gmail threads in one place. Sent, Drafts, everything - beautifully organised.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: "Calendar Workflow",
    desc: "See your schedule at a glance. No tab-switching, no context loss - just flow.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    title: "AI Co-Pilot",
    desc: "Draft emails, summarise threads, and automate actions. Use the '@' trigger to target specific connected accounts.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21l3.75-3.75" />
      </svg>
    ),
    title: "Smart Prioritizer",
    desc: "AI classifies every email as Urgent, Normal, or Low. Learns from your manual overrides with a feedback loop.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    title: "Spam Guard",
    desc: "Phishing and junk mail auto-detected and moved to Gmail spam. Important emails are never misclassified.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Deadline Alerts",
    desc: "AI scans emails for actionable deadlines and auto-escalates priority as the due date approaches.",
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
    desc: "Reply, forward, archive or schedule - type '/' for quick command autocompletes like /prioritize or /draft.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    title: "AI That Learns You",
    desc: "Discovers your writing tone, greeting style, reply speed, and calendar habits. Grows smarter with every interaction.",
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

  // Auth & Billing States
  const { data: sessionData } = authClient.useSession();
  const [subscription, setSubscription] = useState<any>(null);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  useEffect(() => {
    if (sessionData?.user) {
      setIsBillingLoading(true);
      authClient.dodopayments.customer.subscriptions.list({
        query: { limit: 10 }
      })
      .then(({ data, error }: any) => {
        if (data && data.items) {
          const activeSub = data.items.find((sub: any) => sub.status === "active");
          setSubscription(activeSub || null);
        }
        setIsBillingLoading(false);
      })
      .catch((err: any) => {
        console.error("Error fetching subscriptions on landing:", err);
        setIsBillingLoading(false);
      });
    }
  }, [sessionData?.user]);

  const handleUpgrade = async () => {
    if (!sessionData?.user) {
      window.location.href = "/login?redirect=/";
      return;
    }
    try {
      const { data, error } = await authClient.dodopayments.checkoutSession({
        slug: "premium-plan",
      });
      if (error) {
        alert("Billing setup failed: " + (error.message || "Unknown error"));
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert("Error: " + (err.message || err));
    }
  };

  const handleOpenBillingPortal = async () => {
    try {
      const { data, error } = await authClient.dodopayments.customer.portal();
      if (error) {
        alert("Failed to open billing portal: " + (error.message || "Unknown error"));
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert("Error: " + (err.message || err));
    }
  };

  // Stats Counters
  const stat1 = useCountUp(10, 1600, "x");
  const stat2 = useCountUp(98, 1800, "%");
  const stat3 = useCountUp(60, 1400, "%");

  // Interactive mockup states
  const [activeTab, setActiveTab] = useState<"inbox" | "calendar" | "habits">("inbox");
  const [selectedEmail, setSelectedEmail] = useState(0);
  const [aiDraftState, setAiDraftState] = useState<"idle" | "typing" | "done">("idle");
  const [aiText, setAiText] = useState("");
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  // Prioritizer demo states
  const [prioriDemo, setPrioriDemo] = useState<{ classified: boolean; animating: boolean }>({
    classified: false,
    animating: false,
  });
  const prioriEmails = [
    { from: "CTO", subj: "Q3 OKRs - Review ASAP", snippet: "Please review the attached OKRs before tomorrow's board meeting.", priority: "urgent" as const, reason: "Deadline mentioned + high-interaction sender", isSpam: false },
    { from: "billing@stripe.com", subj: "Invoice #4821 - Payment Received", snippet: "Your payment of ₹2,400.00 has been processed successfully.", priority: "low" as const, reason: "Automated billing receipt", isSpam: false },
    { from: "unknown@win-prizes.xyz", subj: "🎉 You WON a FREE iPhone!", snippet: "Click here to claim your prize NOW before it expires!!!", priority: "low" as const, reason: "Phishing / unsolicited spam", isSpam: true },
    { from: "Design Lead", subj: "Figma link: Updated dashboard mockups", snippet: "Hey, shared the latest iteration. Let me know your thoughts.", priority: "normal" as const, reason: "Colleague collaboration thread", isSpam: false },
    { from: "GitHub", subj: "[singularity] PR #87 merged", snippet: "Pull request 'feat: deadline alerts' has been merged to main.", priority: "low" as const, reason: "Automated CI notification", isSpam: false },
  ];

  const runPrioriDemo = () => {
    setPrioriDemo({ classified: false, animating: true });
    setTimeout(() => {
      setPrioriDemo({ classified: true, animating: false });
    }, 1800);
  };

  // AI Learning timeline animation
  const [learningStep, setLearningStep] = useState(0);
  const learningTimeline = [
    { day: "Day 1", event: "Connects Gmail & Calendar", detail: "AI indexes your inbox and calendar events", icon: "🔗" },
    { day: "Day 3", event: "Discovers writing style", detail: "Detects casual greetings, concise replies, \"Best\" sign-offs", icon: "✍️" },
    { day: "Week 1", event: "Maps your network", detail: "Identifies top 5 co-workers by interaction frequency", icon: "👥" },
    { day: "Week 2", event: "Learns calendar patterns", detail: "Prefers 30-min meetings, peak hours 10 AM–12 PM", icon: "📅" },
    { day: "Month 1", event: "Fully personalized", detail: "AI drafts match your voice. Priority accuracy > 95%", icon: "🧠" },
  ];

  // AI Habits simulator states
  const [habitsTone, setHabitsTone] = useState<"friendly" | "professional">("friendly");
  const [habitsStyle, setHabitsStyle] = useState<"concise" | "detailed">("concise");
  const [habitsGreeting, setHabitsGreeting] = useState<"casual" | "formal">("casual");
  const [habitsSignoff, setHabitsSignoff] = useState<"casual" | "formal">("casual");
  const mockEmails = [
    {
      from: "GitHub",
      subj: "Your deployment is ready",
      unread: true,
      time: "2m",
      body: "Your project singularity is live on production! All 14 checks passed successfully. Click to inspect log details.",
      aiReply: "Thanks for the notification. The logs look pristine, and we are seeing great performance. Keep up the excellent work!",
      priority: "low" as const,
      emailAddress: "work@singularity.app",
      reason: "Automated deployment notice"
    },
    {
      from: "Notion Support",
      subj: "Weekly workspace digest",
      unread: true,
      time: "1h",
      body: "Here are updates from your workspace. 12 pages modified by Team Singularity. Key updates: 'Landing page redesign proposal'.",
      aiReply: "Got the updates! Thanks for compiles. I will review the proposal before Q3 planning.",
      priority: "low" as const,
      emailAddress: "personal@gmail.com",
      reason: "Automated activity summary newsletter"
    },
    {
      from: "Linear",
      subj: "Issue SNG-142 resolved",
      unread: false,
      time: "3h",
      body: "Closed by lead developer. Summary: Fix agent compatibility and reasoning log structures.",
      aiReply: "Excellent work on this fix. The reasoning log fix is resolving our API latency perfectly.",
      priority: "normal" as const,
      emailAddress: "work@singularity.app",
      reason: "Colleague activity on closed ticket"
    },
    {
      from: "Dev Team",
      subj: "Re: Q3 planning - next steps",
      unread: false,
      time: "5h",
      body: "Should we schedule the planning meeting for Tuesday morning? I can send over the Agenda doc.",
      aiReply: "Tuesday morning works perfect. Send over the agenda document and I will add it to the calendar.",
      priority: "urgent" as const,
      emailAddress: "work@singularity.app",
      reason: "High-priority meeting scheduling request"
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
            <a href="#prioritizer-demo" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              Smart Prioritizer
            </a>
            <a href="#ai-growth" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              AI Growth
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              How it works
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

              {/* View / Tab Switcher (Visible on mobile/fallback) */}
              <div className="flex items-center rounded-lg bg-bg-base p-1 border border-border-subtle flex-wrap sm:flex-nowrap gap-1">
                <button
                  onClick={() => { setActiveTab("inbox"); }}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    activeTab === "inbox" 
                      ? "bg-bg-raised text-text-primary shadow-xs" 
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => { setActiveTab("calendar"); }}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    activeTab === "calendar" 
                      ? "bg-bg-raised text-text-primary shadow-xs" 
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => { setActiveTab("habits"); }}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    activeTab === "habits" 
                      ? "bg-bg-raised text-text-primary shadow-xs" 
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Settings
                </button>
              </div>
            </div>

            {/* Simulated app workspace */}
            <div className="flex h-[460px] w-full bg-bg-base text-left">
              
              {/* Mockup Sidebar - faithful to Sidebar.tsx */}
              <div className="hidden w-16 flex-col items-center border-r border-border-subtle bg-bg-raised py-4 sm:flex shrink-0 justify-between">
                <div className="flex flex-col items-center gap-1.5 w-full">
                  {/* Logo */}
                  <div className="mb-4 flex h-9 w-9 overflow-hidden items-center justify-center rounded-xl bg-accent-primary text-text-inverse select-none">
                    <img src="/logo.png" alt="Singularity Logo" className="h-full w-full object-cover" />
                  </div>

                  {/* Compose Button Mock */}
                  <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-accent-primary text-text-inverse shadow-sm opacity-90 cursor-default">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </div>

                  {/* Navigation */}
                  <nav className="flex flex-col items-center gap-1.5 w-full">
                    {/* Inbox Nav Icon */}
                    <button
                      onClick={() => setActiveTab("inbox")}
                      aria-label="Inbox"
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                        activeTab === "inbox"
                          ? "bg-accent-primary/15 text-accent-primary"
                          : "text-text-tertiary hover:bg-bg-surface hover:text-text-secondary"
                      }`}
                    >
                      {activeTab === "inbox" && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent-primary" />
                      )}
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                      </svg>
                    </button>

                    {/* Calendar Nav Icon */}
                    <button
                      onClick={() => setActiveTab("calendar")}
                      aria-label="Calendar"
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                        activeTab === "calendar"
                          ? "bg-accent-primary/15 text-accent-primary"
                          : "text-text-tertiary hover:bg-bg-surface hover:text-text-secondary"
                      }`}
                    >
                      {activeTab === "calendar" && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent-primary" />
                      )}
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    </button>

                    {/* Agent Chat Nav Icon */}
                    <button
                      onClick={() => setActiveTab("inbox")}
                      aria-label="Agent Chat"
                      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-text-tertiary hover:bg-bg-surface hover:text-text-secondary transition-all cursor-pointer"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.25 8.25 18 9.25l-.25-1a2 2 0 0 0-1.25-1.25l-1-.25 1-.25a2 2 0 0 0 1.25-1.25l.25-1 .25 1a2 2 0 0 0 1.25 1.25l1 .25-1 .25a2 2 0 0 0-1.25 1.25ZM17.5 20l-.5 1.75L16.5 20a2.5 2.5 0 0 0-1.75-1.75L13 17.75l1.75-.5A2.5 2.5 0 0 0 16.5 15.5l.5-1.75.5 1.75a2.5 2.5 0 0 0 1.75 1.75l1.75.5-1.75.5A2.5 2.5 0 0 0 17.5 20Z" />
                      </svg>
                    </button>
                  </nav>
                </div>

                <div className="flex flex-col items-center gap-1.5 w-full">
                  {/* Shortcuts icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-text-tertiary hover:bg-bg-surface hover:text-text-secondary cursor-default">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                  </div>

                  {/* Settings tab icon */}
                  <button
                    onClick={() => setActiveTab("habits")}
                    aria-label="Settings"
                    className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                      activeTab === "habits"
                        ? "bg-accent-primary/15 text-accent-primary"
                        : "text-text-tertiary hover:bg-bg-surface hover:text-text-secondary"
                    }`}
                  >
                    {activeTab === "habits" && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent-primary" />
                    )}
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    </svg>
                  </button>

                  {/* Theme icon indicator */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-text-tertiary">
                    {theme === "dark" ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                      </svg>
                    )}
                  </div>

                  {/* Avatar indicator */}
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent-primary text-text-inverse text-[10px] font-bold select-none cursor-default">
                    U
                  </div>
                </div>
              </div>

              {/* DYNAMIC CONTENT CONTAINER */}
              {activeTab === "inbox" && (
                <>
                  {/* Email List Column */}
                  <div className="flex w-full flex-col border-r border-border-subtle bg-bg-raised md:w-80 shrink-0">
                    {/* List filter tabs */}
                    <div className="flex border-b border-border-subtle px-3 py-1.5 bg-bg-raised/20 shrink-0 gap-1 overflow-x-auto scrollbar-none">
                      {[
                        { label: "All", count: 4 },
                        { label: "Priority", count: 1 },
                        { label: "Other", count: 3 },
                        { label: "Sent", count: null },
                        { label: "Drafts", count: null },
                      ].map((t) => (
                        <span
                          key={t.label}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md border border-transparent cursor-default shrink-0 ${
                            t.label === "All"
                              ? "bg-bg-surface text-text-primary border-border-default shadow-sm"
                              : "text-text-tertiary hover:text-text-secondary"
                          }`}
                        >
                          {t.label}
                          {t.count !== null && (
                            <span className="ml-1 px-1.5 py-0.2 text-[8px] rounded-full bg-text-tertiary/10 text-text-tertiary">
                              {t.count}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Account filter pills */}
                    <div className="flex gap-1.5 px-3 py-2 border-b border-border-subtle bg-bg-raised/10 overflow-x-auto scrollbar-none shrink-0">
                      <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md border bg-bg-surface text-text-primary border-border-default shadow-sm shrink-0 cursor-default">
                        All Accounts
                      </span>
                      <span className="px-2.5 py-1 text-[9px] font-bold rounded-md border border-transparent text-text-tertiary hover:text-text-secondary shrink-0 cursor-default">
                        work@singularity.app
                      </span>
                      <span className="px-2.5 py-1 text-[9px] font-bold rounded-md border border-transparent text-text-tertiary hover:text-text-secondary shrink-0 cursor-default">
                        personal@gmail.com
                      </span>
                    </div>

                    {/* Threads List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50">
                      {mockEmails.map((email, idx) => {
                        const initials = email.from.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
                        const colors = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
                        const charSum = email.from.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const avatarBg = colors[charSum % colors.length];

                        return (
                          <div
                            key={idx}
                            onClick={() => { setSelectedEmail(idx); }}
                            className={`flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 transition-colors ${
                              selectedEmail === idx 
                                ? "bg-bg-surface border-l-2 border-accent-primary" 
                                : "hover:bg-bg-surface/50"
                            }`}
                          >
                            <span
                              className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[10px] select-none"
                              style={{ backgroundColor: avatarBg }}
                            >
                              {initials || '?'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {email.unread && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary animate-pulse" />
                                  )}
                                  {!email.unread && email.priority === "urgent" && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-danger" />
                                  )}
                                  {!email.unread && email.priority === "normal" && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-warning" />
                                  )}
                                  <span className={`truncate text-xs ${email.unread ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                                    {email.from}
                                  </span>
                                  {email.emailAddress && (
                                    <span className="text-[8px] px-1.5 py-0.2 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded-md font-medium truncate shrink-0">
                                      {email.emailAddress.split('@')[0]}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] text-text-tertiary shrink-0">{email.time}</span>
                              </div>
                              <span className={`block truncate text-xs ${email.unread ? "text-text-secondary font-medium" : "text-text-tertiary"}`}>
                                {email.subj}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Email Detail View */}
                  <div className="hidden flex-1 flex-col bg-bg-base p-5 md:flex overflow-hidden">
                    {/* Header */}
                    <div className="border-b border-border-subtle pb-4 shrink-0">
                      <h3 className="text-sm font-bold text-text-primary">{mockEmails[selectedEmail]?.subj}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1.5">
                        <p className="text-xs text-text-secondary">From: <span className="font-semibold">{mockEmails[selectedEmail]?.from}</span></p>
                        
                        {/* Simulated PrioritySelector Pill */}
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const p = mockEmails[selectedEmail]?.priority ?? "low";
                            const colorClass = p === "urgent" 
                              ? "bg-accent-danger/15 text-accent-danger border border-accent-danger/30" 
                              : p === "normal" 
                              ? "bg-accent-info/15 text-accent-info border border-accent-info/30" 
                              : "bg-bg-surface border border-border-subtle text-text-tertiary";
                            const dotColor = p === "urgent" 
                              ? "bg-accent-danger" 
                              : p === "normal" 
                              ? "bg-accent-info" 
                              : "bg-text-tertiary";
                            return (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${colorClass}`}>
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                                {p}
                              </span>
                            );
                          })()}

                          {mockEmails[selectedEmail]?.reason && (
                            <span className="text-[10px] text-text-tertiary italic truncate max-w-[180px]">
                              "{mockEmails[selectedEmail]?.reason}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 py-4 text-xs text-text-secondary leading-relaxed overflow-y-auto">
                      {mockEmails[selectedEmail]?.body}
                    </div>

                    {/* Dynamic AI Co-Pilot block */}
                    <div className="rounded-xl border border-border-default bg-bg-raised p-4 shadow-sm shrink-0">
                      <div className="flex items-center justify-between pb-3">
                        <span className="text-xs font-bold text-text-primary">✨ AI Smart Reply</span>

                        {aiDraftState === "idle" && (
                          <button
                            onClick={() => triggerAiDraft(selectedEmail)}
                            className="rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-semibold text-text-inverse hover:bg-accent-primary-hover transition-colors cursor-pointer"
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
                            className="text-[10px] text-text-tertiary hover:text-text-primary font-medium cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "calendar" && (
                // CALENDAR WORKFLOW VIEW
                <div className="flex w-full flex-col bg-bg-raised p-4 sm:p-6 overflow-hidden">
                  {/* Calendar Navigation Header & Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-4 shrink-0 gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-bg-surface border border-border-default px-2 py-1 text-xs font-semibold text-text-primary select-none cursor-default">
                        &larr;
                      </span>
                      <span className="rounded bg-bg-surface border border-border-default px-2.5 py-1 text-xs font-bold text-text-primary select-none cursor-default">
                        Today
                      </span>
                      <span className="rounded bg-bg-surface border border-border-default px-2 py-1 text-xs font-semibold text-text-primary select-none cursor-default">
                        &rarr;
                      </span>
                      <span className="text-xs font-bold text-text-primary ml-1.5">
                        Tuesday, Jun 16, 2026
                      </span>
                    </div>

                    {/* View Switcher Tabs */}
                    <div className="flex bg-bg-base border border-border-subtle rounded-lg p-1 gap-1 shrink-0">
                      {["List", "Day", "Week", "Month"].map((v) => (
                        <span
                          key={v}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-default ${
                            v === "Day"
                              ? "bg-bg-surface text-text-primary border border-border-default shadow-sm"
                              : "text-text-tertiary"
                          }`}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Calendar Accounts Pills */}
                  <div className="flex gap-1.5 py-2.5 border-b border-border-subtle bg-bg-raised/10 overflow-x-auto scrollbar-none shrink-0">
                    <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md border bg-bg-surface text-text-primary border-border-default shadow-sm shrink-0 cursor-default">
                      All Accounts
                    </span>
                    <span className="px-2.5 py-1 text-[9px] font-bold rounded-md border border-transparent text-text-tertiary shrink-0 cursor-default">
                      work@singularity.app
                    </span>
                    <span className="px-2.5 py-1 text-[9px] font-bold rounded-md border border-transparent text-text-tertiary shrink-0 cursor-default">
                      personal@gmail.com
                    </span>
                  </div>

                  {/* Hourly mock blocks */}
                  <div className="flex-1 overflow-y-auto py-2 divide-y divide-border-subtle/30 pr-1">
                    {[
                      { 
                        time: "09:00 AM", 
                        events: [
                          { summary: "Weekly Development Alignment", range: "09:00 AM – 09:30 AM", location: "Google Meet", account: "work" }
                        ] 
                      },
                      { 
                        time: "10:00 AM", 
                        events: [] 
                      },
                      { 
                        time: "11:00 AM", 
                        events: [
                          { summary: "Client Feedback Call", range: "11:00 AM – 11:45 AM", location: "Zoom", account: "work" }
                        ] 
                      },
                      { 
                        time: "12:00 PM", 
                        events: [
                          { summary: "Team Lunch & Sync", range: "12:00 PM – 01:00 PM", location: "Cafeteria", account: "personal" }
                        ] 
                      },
                      { 
                        time: "01:00 PM", 
                        events: [] 
                      },
                      { 
                        time: "02:00 PM", 
                        events: [
                          { summary: "Deep Work: Landing Page builds", range: "02:00 PM – 04:00 PM", location: null, account: "work" }
                        ] 
                      },
                    ].map((slot, idx) => (
                      <div key={idx} className="flex min-h-[64px] hover:bg-bg-surface/10 transition-colors">
                        {/* Hour Label */}
                        <div className="w-16 shrink-0 py-2.5 px-3 text-right text-[10px] font-bold text-text-tertiary border-r border-border-subtle/30 select-none">
                          {slot.time}
                        </div>

                        {/* Slots Content area */}
                        <div className="flex-1 p-2 flex gap-2 overflow-x-auto scrollbar-none relative">
                          {slot.events.length > 0 ? (
                            slot.events.map((event, eIdx) => (
                              <div
                                key={eIdx}
                                className="group/card flex-1 min-w-[200px] max-w-sm p-2 bg-bg-surface/60 border border-border-subtle rounded-md transition-all text-left shadow-2xs relative overflow-hidden flex flex-col justify-between"
                              >
                                {/* Left border indicator */}
                                <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-accent-info" />
                                <div className="pl-2">
                                  <div className="text-[11px] font-semibold text-text-primary truncate">
                                    {event.summary}
                                  </div>
                                  <div className="flex items-center justify-between mt-1 flex-wrap sm:flex-nowrap gap-1">
                                    <span className="text-[9px] text-accent-info font-bold">
                                      {event.range}
                                    </span>
                                    {event.location && (
                                      <span className="text-[9px] text-text-tertiary truncate max-w-[100px] flex items-center gap-0.5">
                                        <span>📍</span>
                                        <span className="truncate">{event.location}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="pl-2 mt-1 flex items-center justify-between">
                                  <span className="text-[8px] px-1 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded font-medium">
                                    {event.account}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="w-full h-full flex items-center justify-start opacity-0 hover:opacity-100 transition-opacity pl-2 select-none">
                              <span className="text-[9px] text-accent-primary font-bold flex items-center gap-1 cursor-default">
                                ➕ Add event
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "habits" && (
                <div className="flex flex-col flex-1 bg-bg-base overflow-hidden">
                  
                  {/* Mock Settings Tab Bar */}
                  <div className="flex border-b border-border-subtle px-4 py-1.5 bg-bg-raised/35 shrink-0 gap-2 overflow-x-auto scrollbar-none">
                    {["Workspace", "Account", "AI Persona & Habits"].map((tab) => (
                      <span
                        key={tab}
                        className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-default shrink-0 transition-all ${
                          tab === "AI Persona & Habits"
                            ? "bg-bg-surface text-text-primary border-border-default shadow-xs"
                            : "text-text-tertiary border-transparent hover:text-text-secondary"
                        }`}
                      >
                        {tab}
                      </span>
                    ))}
                  </div>

                  {/* Main Settings Panel */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Header Banner */}
                    <div className="rounded-xl p-4 border border-border-default bg-gradient-to-br from-bg-raised/40 via-bg-surface/10 to-accent-primary/5 relative overflow-hidden shrink-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary">
                          <svg className="h-5 w-5 text-accent-primary animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-text-primary">AI Persona & Workspace Habits</h4>
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-ping" />
                              Active Learning
                            </span>
                          </div>
                          <p className="text-[10px] text-text-secondary mt-1 leading-relaxed">
                            Singularity constantly analyzes your sent replies, communication speed, and scheduling history to adapt your AI co-pilot.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mini Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 shrink-0">
                      {[
                        { label: "Manual Corrections", count: 12, desc: "Refines few-shot rules" },
                        { label: "Emails Prioritized", count: 847, desc: "AI triaged emails" },
                        { label: "Spam Guard Filtered", count: 153, desc: "Junk mails auto-blocked" },
                      ].map((s) => (
                        <div key={s.label} className="p-2.5 rounded-lg border border-border-default bg-bg-surface/30">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary block truncate">{s.label}</span>
                          <span className="text-lg font-bold text-text-primary block mt-0.5">{s.count}</span>
                          <span className="text-[8px] text-text-tertiary block truncate mt-0.5">{s.desc}</span>
                        </div>
                      ))}
                    </div>

                    {/* Split View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Toggles */}
                      <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-raised p-4">
                        <div className="border-b border-border-subtle pb-2">
                          <span className="text-xs font-bold text-text-primary">Interactive AI Trainer</span>
                          <p className="text-[9px] text-text-tertiary mt-0.5">Toggle styles to see how the AI adapts.</p>
                        </div>

                        {/* Tone select */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">Tone & Style</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setHabitsTone("friendly")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsTone === "friendly"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Friendly
                            </button>
                            <button
                              onClick={() => setHabitsTone("professional")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsTone === "professional"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Professional
                            </button>
                          </div>
                        </div>

                        {/* Length select */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">Draft Length</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setHabitsStyle("concise")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsStyle === "concise"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Concise
                            </button>
                            <button
                              onClick={() => setHabitsStyle("detailed")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsStyle === "detailed"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Detailed
                            </button>
                          </div>
                        </div>

                        {/* Greeting select */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">Greeting</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setHabitsGreeting("casual")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsGreeting === "casual"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Casual ("Hi")
                            </button>
                            <button
                              onClick={() => setHabitsGreeting("formal")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsGreeting === "formal"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Formal ("Dear")
                            </button>
                          </div>
                        </div>

                        {/* Signoff select */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">Sign-off</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setHabitsSignoff("casual")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsSignoff === "casual"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Casual ("Best")
                            </button>
                            <button
                              onClick={() => setHabitsSignoff("formal")}
                              className={`px-2 py-1 text-[9px] font-semibold border rounded-md transition-all cursor-pointer ${
                                habitsSignoff === "formal"
                                  ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                                  : "border-border-default text-text-secondary hover:bg-bg-surface"
                              }`}
                            >
                              Formal ("Sincerely")
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Live Preview & Discovered Stats */}
                      <div className="flex flex-col gap-4">
                        {/* Live Preview Box */}
                        <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-bg-raised p-4">
                          <div className="border-b border-border-subtle pb-2">
                            <span className="text-xs font-bold text-text-primary">Live AI Copilot Draft Editor</span>
                            <p className="text-[9px] text-text-secondary mt-0.5">Adapts dynamically to trainer settings</p>
                          </div>
                          <div className="rounded-lg bg-bg-surface/50 border border-border-subtle p-3 font-mono text-[10px] leading-relaxed text-text-primary whitespace-pre-wrap min-h-[140px]">
                            {(() => {
                              const greeting = habitsGreeting === "casual" ? "Hi Team Acme," : "Dear Acme Partnership Board,";
                              let body = "";
                              if (habitsStyle === "concise") {
                                body = habitsTone === "friendly" 
                                  ? "We'd love to integrate our email workflows with your API! Let's schedule a quick sync." 
                                  : "We formally propose integrating our email workflows with your API. Let us know when you can review the technical specs.";
                              } else {
                                body = habitsTone === "friendly"
                                  ? "I hope you are having an amazing week! We have been looking closely at the Acme API capabilities and believe a direct integration with Singularity would be a game-changer for both our users. It would allow seamless cross-platform syncs in under 2 seconds. Let's find 15 mins to discuss this!"
                                  : "We are writing to formally propose a workflow integration between Singularity and the Acme API. Our research indicates that a combined solution would significantly reduce synchronization latency for enterprise customers. We have attached the technical specifications below for your engineering review.";
                              }
                              const signoff = habitsSignoff === "casual" ? "Best,\nRushil" : "Sincerely,\nRushil Parmar\nSingularity Team";
                              return `${greeting}\n\n${body}\n\n${signoff}`;
                            })()}
                          </div>
                        </div>

                        {/* Discovered Insights Box */}
                        <div className="rounded-xl border border-border-default bg-bg-surface/40 p-4 space-y-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block border-b border-border-subtle pb-1.5">
                            Discovered Writing Style Insights
                          </span>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Email Tone</span>
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                              {habitsTone === "friendly" ? "Friendly & Conversational" : "Formal & Professional"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Writing Style</span>
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                              {habitsStyle === "concise" ? "Concise & Brief" : "Detailed & Structured"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Greeting Preference</span>
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                              {habitsGreeting === "casual" ? "Casual (Hi/Hello)" : "Formal (Dear)"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">Sign-off Style</span>
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                              {habitsSignoff === "casual" ? "Appreciative (Best)" : "Formal (Sincerely)"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border-subtle/50">
                            <span className="text-text-secondary font-medium">Primary Collaborators</span>
                            <span className="text-[10px] font-semibold text-text-primary max-w-[140px] truncate">
                              Sarah K. (Design), Raj M. (CTO)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border-default bg-bg-raised p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-accent-primary hover:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-bg-surface border border-border-default text-text-primary shadow-xs">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-base font-bold text-text-primary">{f.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ INTERACTIVE: SMART PRIORITIZER DEMO ══════════════════ */}
      <section id="prioritizer-demo" className="relative z-10 mx-auto mt-32 max-w-5xl px-6 md:px-12">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-bold text-text-primary">
            🛡️ Smart Inbox Triage
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Watch AI classify your inbox{" "}
            <span className="bg-gradient-to-r from-text-primary via-text-secondary to-text-primary bg-clip-text text-transparent">
              in real-time
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-text-secondary">
            Every email gets an AI-powered priority badge, spam detection, and a transparent reason for the classification.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-raised shadow-xl">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary">📥 Inbox Preview</span>
              <span className="rounded bg-bg-base border border-border-default px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                {prioriEmails.length} emails
              </span>
            </div>
            <button
              onClick={runPrioriDemo}
              disabled={prioriDemo.animating}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                prioriDemo.animating
                  ? "bg-bg-surface text-text-tertiary border border-border-default"
                  : prioriDemo.classified
                    ? "bg-bg-surface text-text-primary border border-border-default hover:bg-bg-base"
                    : "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover shadow-sm"
              }`}
            >
              {prioriDemo.animating ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-tertiary border-t-text-primary" />
                  Classifying…
                </span>
              ) : prioriDemo.classified ? (
                "↻ Re-classify"
              ) : (
                "✨ Classify Inbox"
              )}
            </button>
          </div>

          {/* Email rows */}
          <div className="divide-y divide-border-subtle/50">
            {prioriEmails.map((email, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 px-5 py-3.5 transition-all duration-500 ${
                  prioriDemo.animating
                    ? "opacity-60"
                    : prioriDemo.classified && email.isSpam
                      ? "bg-accent-danger/3 opacity-70"
                      : ""
                }`}
                style={{
                  transitionDelay: prioriDemo.classified ? `${idx * 200}ms` : "0ms",
                }}
              >
                {/* Sender avatar */}
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${
                  prioriDemo.classified && email.isSpam
                    ? "bg-accent-danger/10 border-accent-danger/30 text-accent-danger"
                    : "bg-bg-surface border-border-default text-text-primary"
                }`}>
                  {email.from[0]}
                </div>

                {/* Email info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${prioriDemo.classified && email.isSpam ? "text-text-tertiary line-through" : "text-text-primary"}`}>
                      {email.from}
                    </span>
                    {prioriDemo.classified && email.isSpam && (
                      <span className="rounded bg-accent-danger/15 px-1.5 py-0.5 text-[9px] font-bold text-accent-danger animate-in fade-in">
                        ⚠ SPAM
                      </span>
                    )}
                  </div>
                  <p className={`truncate text-xs ${prioriDemo.classified && email.isSpam ? "text-text-tertiary line-through" : "text-text-secondary"}`}>
                    {email.subj}
                  </p>
                </div>

                {/* Priority badge */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {prioriDemo.classified ? (
                    <>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all duration-300 ${
                        email.isSpam
                          ? "bg-accent-danger/10 text-accent-danger border border-accent-danger/20"
                          : email.priority === "urgent"
                            ? "bg-accent-danger/10 text-accent-danger border border-accent-danger/20"
                            : email.priority === "normal"
                              ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/20"
                              : "bg-bg-surface text-text-tertiary border border-border-default"
                      }`}>
                        {email.isSpam ? "Spam" : email.priority === "urgent" ? "🔴 Urgent" : email.priority === "normal" ? "🟡 Normal" : "⚪ Low"}
                      </span>
                      <span className="text-[9px] text-text-tertiary max-w-[160px] text-right hidden sm:block">
                        {email.reason}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-bg-surface border border-border-default px-2.5 py-0.5 text-[10px] font-medium text-text-tertiary">
                      Unclassified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary footer */}
          {prioriDemo.classified && (
            <div className="flex items-center justify-between border-t border-border-subtle bg-bg-surface px-5 py-3">
              <div className="flex items-center gap-4 text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-accent-danger">🔴 1 Urgent</span>
                <span className="flex items-center gap-1 text-accent-primary">🟡 1 Normal</span>
                <span className="flex items-center gap-1 text-text-tertiary">⚪ 2 Low</span>
                <span className="flex items-center gap-1 text-accent-danger">⚠ 1 Spam blocked</span>
              </div>
              <span className="text-[10px] text-accent-success font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-success animate-pulse-subtle" />
                Classification complete
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-text-tertiary italic">
          💡 Click &quot;Classify Inbox&quot; to see AI triage in action — spam gets flagged, priorities get assigned.
        </p>
      </section>

      {/* ══════════════════ INTERACTIVE: AI THAT GROWS WITH YOU ══════════════════ */}
      <section id="ai-growth" className="relative z-10 mx-auto mt-32 max-w-5xl px-6 md:px-12">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-bold text-text-primary">
            🧠 Adaptive Intelligence
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            An AI that{" "}
            <span className="bg-gradient-to-r from-text-primary via-text-secondary to-text-primary bg-clip-text text-transparent">
              grows with you
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-text-secondary">
            From day one, Singularity starts learning your communication style, network, and calendar habits. No configuration needed.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-raised shadow-xl">
          {/* Timeline header */}
          <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-5 py-3.5">
            <span className="text-xs font-bold text-text-primary">📈 Learning Progress Timeline</span>
            <span className="rounded bg-bg-base border border-border-default px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
              Click milestones to explore
            </span>
          </div>

          <div className="flex flex-col md:flex-row">
            {/* Left: Timeline steps */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border-subtle bg-bg-raised p-4 shrink-0">
              <div className="relative space-y-1">
                {/* Vertical line */}
                <div className="absolute left-[15px] top-4 h-[calc(100%-2rem)] w-px bg-border-default" />

                {learningTimeline.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLearningStep(idx)}
                    className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all cursor-pointer ${
                      learningStep === idx
                        ? "bg-bg-surface border border-border-default shadow-xs"
                        : "hover:bg-bg-surface/50"
                    }`}
                  >
                    <div className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm transition-all ${
                      learningStep === idx
                        ? "bg-accent-primary text-text-inverse shadow-sm"
                        : idx <= learningStep
                          ? "bg-accent-success/15 text-accent-success border border-accent-success/30"
                          : "bg-bg-surface border border-border-default text-text-tertiary"
                    }`}>
                      {idx <= learningStep && idx !== learningStep ? "✓" : step.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{step.day}</span>
                      </div>
                      <span className={`text-xs font-semibold ${learningStep === idx ? "text-text-primary" : "text-text-secondary"}`}>
                        {step.event}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Detail view */}
            <div className="flex-1 p-6 flex flex-col justify-between bg-bg-base min-h-[300px]">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/10 text-xl border border-accent-primary/20">
                    {learningTimeline[learningStep]?.icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-accent-primary uppercase tracking-wider">{learningTimeline[learningStep]?.day}</span>
                    <h3 className="text-sm font-bold text-text-primary">{learningTimeline[learningStep]?.event}</h3>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-6">
                  {learningTimeline[learningStep]?.detail}
                </p>

                {/* Contextual detail card for each step */}
                {learningStep === 0 && (
                  <div className="rounded-xl border border-border-default bg-bg-raised p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">Gmail Inbox</span>
                      <span className="text-accent-success font-bold">✓ Connected</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">Google Calendar</span>
                      <span className="text-accent-success font-bold">✓ Connected</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">Emails indexed</span>
                      <span className="text-text-primary font-bold">1,247</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary font-medium">Events synced</span>
                      <span className="text-text-primary font-bold">89</span>
                    </div>
                  </div>
                )}

                {learningStep === 1 && (
                  <div className="rounded-xl border border-border-default bg-bg-raised p-4 space-y-2.5">
                    {[
                      { label: "Greeting Style", value: "Casual (\"Hi\", \"Hey\")" },
                      { label: "Reply Length", value: "Concise — avg. 3 sentences" },
                      { label: "Sign-off", value: "\"Best\" or \"Thanks\"" },
                      { label: "Tone", value: "Friendly & direct" },
                    ].map((h) => (
                      <div key={h.label} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary font-medium">{h.label}</span>
                        <span className="rounded bg-bg-surface border border-border-default px-2 py-0.5 text-[10px] font-semibold text-text-primary">{h.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {learningStep === 2 && (
                  <div className="rounded-xl border border-border-default bg-bg-raised p-4 space-y-2.5">
                    {[
                      { name: "Sarah K.", count: "47 threads", role: "Design Lead" },
                      { name: "Raj M.", count: "38 threads", role: "CTO" },
                      { name: "Alex P.", count: "31 threads", role: "Product Manager" },
                      { name: "Dev Team", count: "28 threads", role: "Group Thread" },
                      { name: "Maya L.", count: "19 threads", role: "Marketing" },
                    ].map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-bg-surface border border-border-default flex items-center justify-center text-[10px] font-bold text-text-primary">
                            {c.name[0]}
                          </div>
                          <span className="font-semibold text-text-primary">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text-tertiary">{c.role}</span>
                          <span className="rounded bg-bg-surface border border-border-default px-1.5 py-0.5 text-[9px] font-bold text-text-secondary">{c.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {learningStep === 3 && (
                  <div className="rounded-xl border border-border-default bg-bg-raised p-4 space-y-2.5">
                    {[
                      { label: "Preferred Duration", value: "30 minutes" },
                      { label: "Peak Meeting Hours", value: "10:00 AM – 12:00 PM" },
                      { label: "Busiest Day", value: "Tuesday" },
                      { label: "Average Meetings/Week", value: "8" },
                    ].map((h) => (
                      <div key={h.label} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary font-medium">{h.label}</span>
                        <span className="rounded bg-bg-surface border border-border-default px-2 py-0.5 text-[10px] font-semibold text-text-primary">{h.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {learningStep === 4 && (
                  <div className="rounded-xl border border-border-default bg-bg-raised p-4 space-y-3">
                    <div className="text-xs text-text-secondary font-medium mb-2">AI Personalization Score</div>
                    <div className="flex items-end gap-1">
                      {[15, 32, 48, 67, 95].map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t-md transition-all ${
                              i === 4 ? "bg-accent-primary" : "bg-border-default"
                            }`}
                            style={{ height: `${v}px` }}
                          />
                          <span className="text-[8px] text-text-tertiary font-bold">{["D1", "D3", "W1", "W2", "M1"][i]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className="text-text-tertiary">Priority Accuracy</span>
                      <span className="text-accent-success font-bold text-sm">95%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-tertiary">Draft Match Rate</span>
                      <span className="text-accent-success font-bold text-sm">92%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-[10px] font-semibold text-text-tertiary mb-2">
                  <span>Personalization Progress</span>
                  <span className="text-text-primary">{Math.round(((learningStep + 1) / learningTimeline.length) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-bg-surface border border-border-subtle overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-all duration-500"
                    style={{ width: `${((learningStep + 1) / learningTimeline.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-text-tertiary italic">
          💡 Click each milestone to see what the AI learns at every stage.
        </p>
      </section>

      {/* ══════════════════ PRICING SECTION ══════════════════ */}
      <section id="pricing" className="relative z-10 mx-auto mt-32 max-w-7xl px-6 md:px-12 lg:px-20">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-4 py-1.5 text-xs font-bold text-text-primary">
            Simple, Transparent Pricing
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
            Choose the plan that{" "}
            <span className="bg-gradient-to-r from-text-primary via-text-secondary to-text-primary bg-clip-text text-transparent">
              fits your workflow
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-text-secondary">
            Unify your communications and schedule today. Upgrade to unlock full AI automation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Free Plan */}
          <div className="flex flex-col rounded-3xl border border-border-default bg-bg-raised p-8 shadow-sm justify-between transition-all duration-300 hover:-translate-y-1">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Free Tier</h3>
              <p className="mt-2 text-xs text-text-tertiary">For individuals getting started.</p>
              <div className="mt-4 flex items-baseline text-text-primary">
                <span className="text-4xl font-extrabold tracking-tight">₹0</span>
                <span className="ml-1 text-sm font-semibold text-text-secondary">/month</span>
              </div>
              <ul className="mt-6 space-y-4 text-xs text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> Unified Gmail Inbox
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> Google Calendar Sync
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> Smart Prioritizer & Spam Guard
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> AI Habit Learning & Persona
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> Keyboard / Slash Commands
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> AI Copilot (20 requests/day)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span> Max 1 Gmail/Calendar account
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Link
                href="/login"
                className="block w-full text-center rounded-xl bg-bg-surface border border-border-default py-2.5 text-xs font-semibold text-text-primary hover:bg-bg-base transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>

          {/* Premium Plan */}
          <div className="relative flex flex-col rounded-3xl border-2 border-accent-primary bg-bg-raised p-8 shadow-md justify-between transition-all duration-300 hover:-translate-y-1">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-inverse shadow-sm">
              Popular - 49% Off
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Premium</h3>
              <p className="mt-2 text-xs text-text-tertiary">For power users looking to automate their routine.</p>
              <div className="mt-4 flex flex-col text-text-primary">
                <div className="flex items-baseline">
                  <span className="text-4xl font-extrabold tracking-tight">₹304.98</span>
                  <span className="ml-1 text-sm font-semibold text-text-secondary">/month</span>
                </div>
                <span className="text-[11px] text-accent-primary font-semibold line-through mt-0.5">
                  Regular ₹598.00/month
                </span>
              </div>
              <ul className="mt-6 space-y-4 text-xs text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Unlimited AI Co-Pilot requests
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Connect up to 3 accounts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Multi-Account @ Targeting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Careful & Autonomous Modes
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Deadline Auto-Escalation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Priority Digests & Smart Alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Full Hourly Day View Timeline
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-primary">✨</span> Click-to-Create pre-population
                </li>
              </ul>
            </div>
            <div className="mt-8">
              {isBillingLoading ? (
                <div className="w-full h-10 rounded-xl bg-bg-surface animate-pulse-subtle" />
              ) : subscription ? (
                <button
                  onClick={handleOpenBillingPortal}
                  className="block w-full text-center rounded-xl bg-bg-surface border border-border-default py-2.5 text-xs font-semibold text-text-primary hover:bg-bg-base transition-colors cursor-pointer"
                >
                  Manage Subscription
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  className="block w-full text-center rounded-xl bg-accent-primary py-2.5 text-xs font-semibold text-text-inverse hover:bg-accent-primary-hover transition-all cursor-pointer"
                >
                  {sessionData?.user ? "Upgrade to Premium" : "Get Premium"}
                </button>
              )}
            </div>
          </div>

          {/* Business Plan */}
          <div className="flex flex-col rounded-3xl border border-border-default bg-bg-raised p-8 shadow-sm justify-between transition-all duration-300 hover:-translate-y-1">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Business</h3>
              <p className="mt-2 text-xs text-text-tertiary">For teams and organizations.</p>
              <div className="mt-4 flex items-baseline text-text-primary">
                <span className="text-4xl font-extrabold tracking-tight">Custom</span>
              </div>
              <ul className="mt-6 space-y-4 text-xs text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="text-indigo-500">💼</span> Shared team calendars
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-indigo-500">💼</span> Enterprise-grade AI customization
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-indigo-500">💼</span> Higher rate limits and SLA
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-indigo-500">💼</span> Dedicated support channel
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <a
                href="https://x.com/Axemoth"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center rounded-xl bg-bg-surface border border-border-default py-2.5 text-xs font-semibold text-text-primary hover:bg-bg-base transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
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
            <Link href="/privacy" className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
