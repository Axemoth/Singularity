"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/app/_components/ui/button";

interface TourStep {
  title: string;
  description: string;
  path: string;
  selector?: string;
  buttonText: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Singularity 🚀",
    description: "Your new AI-powered email and calendar assistant. Let's take a quick 1-minute tour of the workspace.",
    path: "/dashboard",
    buttonText: "Start Tour",
  },
  {
    title: "1. The Workspace Dashboard 📊",
    description: "Monitor your unread emails, sent statistics, and upcoming calendar meetings in real-time, filtered by date or account.",
    path: "/dashboard",
    selector: "#sidebar-nav-dashboard",
    buttonText: "Next: Smart Inbox",
  },
  {
    title: "2. Prioritized Inbox 📥",
    description: "Scan messages quickly with solid unread left borders and inline priority tags. Open threads to see collapsible conversation cards.",
    path: "/inbox",
    selector: "#sidebar-nav-inbox",
    buttonText: "Next: Calendar",
  },
  {
    title: "3. Calendar Sync 📅",
    description: "View scheduled events, check locations, and sync event summaries seamlessly with Google Calendar.",
    path: "/calendar",
    selector: "#sidebar-nav-calendar",
    buttonText: "Next: Agent Chat",
  },
  {
    title: "4. Autonomous Agent Chat 💬",
    description: "Collaborate with your AI Copilot. Ask it to draft replies, parse uploaded contact lists, or run background tasks.",
    path: "/agent",
    selector: "#sidebar-nav-agent",
    buttonText: "Next: Settings",
  },
  {
    title: "5. Settings & Tuning ⚙️",
    description: "Configure your custom AI priority instructions, choose operation modes, or replay this tour anytime.",
    path: "/settings",
    selector: "#sidebar-nav-settings",
    buttonText: "Finish Tour",
  },
];

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Check if tour was already completed or skipped on initial load
  useEffect(() => {
    const isCompleted = localStorage.getItem("singularity-tour-completed");
    if (isCompleted !== "true") {
      setIsActive(true);
    }
  }, []);

  // Listen for custom start tour events (e.g. from Settings)
  useEffect(() => {
    const startTourHandler = () => {
      localStorage.removeItem("singularity-tour-completed");
      setStep(0);
      setIsActive(true);
      
      const firstStep = TOUR_STEPS[0];
      if (firstStep && pathname !== firstStep.path) {
        router.push(firstStep.path);
      }
    };

    window.addEventListener("start-singularity-tour", startTourHandler);
    return () => {
      window.removeEventListener("start-singularity-tour", startTourHandler);
    };
  }, [pathname, router]);

  // Handle position tracking and window resizing
  useEffect(() => {
    if (!isActive) {
      setCoords(null);
      setHighlightRect(null);
      return;
    }

    const currentStep = TOUR_STEPS[step];
    if (!currentStep) return;

    // Hide tooltip if page transitions are in progress
    if (pathname !== currentStep.path) {
      setCoords(null);
      setHighlightRect(null);
      return;
    }

    const updatePosition = () => {
      if (!currentStep.selector) {
        setCoords(null);
        setHighlightRect(null);
        return;
      }

      const element = document.querySelector(currentStep.selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        
        setHighlightRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });

        // Position tooltip to the right of the sidebar item
        // Center vertically relative to the target item (assuming tooltip height is roughly 160px)
        const topPos = Math.max(16, rect.top + rect.height / 2 - 80);
        const leftPos = rect.right + 16;

        setCoords({
          top: topPos,
          left: leftPos,
        });
      } else {
        setCoords(null);
        setHighlightRect(null);
      }
    };

    // Trigger update immediately
    updatePosition();

    // Set up a short interval/timer to poll until element becomes available (helps with route loading delays)
    const interval = setInterval(updatePosition, 100);
    const timer = setTimeout(updatePosition, 300);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [step, pathname, isActive]);

  const goToStep = (stepIdx: number) => {
    const targetStep = TOUR_STEPS[stepIdx];
    if (targetStep) {
      setStep(stepIdx);
      if (pathname !== targetStep.path) {
        router.push(targetStep.path);
      }
    }
  };

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      goToStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem("singularity-tour-completed", "true");
    setIsActive(false);
  };

  if (!isActive) return null;

  const currentStep = TOUR_STEPS[step]!;
  const showBackdrop = step === 0; // Show overlay backdrop for the Welcome screen

  return (
    <>
      {/* Backdrop overlay for step 0 */}
      {showBackdrop && (
        <div 
          onClick={handleSkip}
          className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[9998] animate-fade-in"
        />
      )}

      {/* Target Element Highlight Spotlight */}
      {highlightRect && (
        <div
          className="fixed border border-accent-primary bg-accent-primary/5 rounded-[var(--radius-md)] shadow-[0_0_15px_rgba(6,182,212,0.4)] pointer-events-none transition-all duration-[var(--transition-slow)] z-[9998] animate-pulse-subtle"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      {/* Tour Card Tooltip */}
      <div
        style={coords ? { top: `${coords.top}px`, left: `${coords.left}px` } : undefined}
        className={`z-[9999] animate-slide-up select-none max-w-[340px] w-full ${
          coords 
            ? "fixed" 
            : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        }`}
      >
        <div className="relative w-full bg-bg-overlay/95 border border-border-default/80 backdrop-blur-md shadow-2xl rounded-2xl p-5 flex flex-col gap-4">
          
          {/* Arrow pointing to highlighted item */}
          {coords && (
            <div className="absolute top-[32px] -left-2 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-bg-overlay/95 filter drop-shadow-[-2px_0_1px_rgba(0,0,0,0.06)] pointer-events-none" />
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, idx) => (
                <span
                  key={idx}
                  onClick={() => goToStep(idx)}
                  className={`h-1.5 rounded-full cursor-pointer transition-all duration-[var(--transition-fast)] ${
                    step === idx ? "bg-accent-primary w-4" : "bg-text-tertiary/20 hover:bg-text-tertiary/40"
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-text-tertiary uppercase">
              Step {step + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-text-primary tracking-tight font-sans">
              {currentStep.title}
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed font-medium">
              {currentStep.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border-default/50">
            <button
              onClick={handleSkip}
              className="text-[11px] font-bold text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              Skip Tour
            </button>
            
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-accent-primary text-text-inverse hover:bg-accent-primary-hover font-semibold py-1.5 px-3 rounded-lg text-xs cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {currentStep.buttonText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
