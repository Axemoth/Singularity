"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/server/better-auth/client";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/app/_components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: sessionData, isPending: isSessionPending } = authClient.useSession();

  // Settings State
  const [priorityInput, setPriorityInput] = useState("");
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  // Billing State
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
        console.error("Error fetching subscriptions:", err);
        setIsBillingLoading(false);
      });
    }
  }, [sessionData?.user]);

  const handleUpgrade = async () => {
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

  // Queries for settings
  const { data: dbPriorityRules } = api.gmail.getPriorityRules.useQuery(undefined, {
    enabled: !!sessionData?.user,
  });
  const { data: dbUsername } = api.gmail.getUsername.useQuery(undefined, {
    enabled: !!sessionData?.user,
  });
  const { data: dbModelMode } = api.gmail.getModelMode.useQuery(undefined, {
    enabled: !!sessionData?.user,
  });

  // Effects to sync settings input
  useEffect(() => {
    if (dbPriorityRules !== undefined) {
      setPriorityInput(dbPriorityRules);
    }
  }, [dbPriorityRules]);

  useEffect(() => {
    if (dbUsername !== undefined) {
      setUsernameInput(dbUsername);
    }
  }, [dbUsername]);

  // Mutations for settings
  const setRulesMutation = api.gmail.setPriorityRules.useMutation({
    onSuccess: () => {
      void utils.gmail.getPriorityRules.invalidate();
      void utils.gmail.listThreads.invalidate();
      setIsEditingPriority(false);
    },
  });

  const setUsernameMutation = api.gmail.setUsername.useMutation({
    onSuccess: () => {
      void utils.gmail.getUsername.invalidate();
      setIsEditingUsername(false);
    },
  });

  const setModelModeMutation = api.gmail.setModelMode.useMutation({
    onSuccess: () => {
      void utils.gmail.getModelMode.invalidate();
    },
  });

  // Queries for integration statuses
  const { data: gmailStatus, isLoading: isGmailLoading } = api.gmail.getConnectionStatus.useQuery(undefined, {
    enabled: !!sessionData?.user,
  });
  const { data: calendarStatus, isLoading: isCalendarLoading } = api.calendar.getConnectionStatus.useQuery(undefined, {
    enabled: !!sessionData?.user,
  });

  // Mutations for disconnecting integration
  const disconnectGmail = api.gmail.disconnect.useMutation({
    onSuccess: async () => {
      await utils.gmail.getConnectionStatus.invalidate();
      await utils.gmail.listThreads.invalidate();
    },
  });

  const disconnectCalendar = api.calendar.disconnect.useMutation({
    onSuccess: async () => {
      await utils.calendar.getConnectionStatus.invalidate();
      await utils.calendar.listEvents.invalidate();
    },
  });

  const handleSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login");
            router.refresh();
          },
        },
      });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleConnect = (plugin: "gmail" | "googlecalendar") => {
    window.location.href = `/api/connect?plugin=${plugin}`;
  };

  const handleDisconnect = (plugin: "gmail" | "googlecalendar") => {
    if (plugin === "gmail") {
      disconnectGmail.mutate();
    } else {
      disconnectCalendar.mutate();
    }
  };

  return (
    <div className="min-h-full bg-bg-base px-6 py-10 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-2xl flex flex-col gap-8 animate-slide-up">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Manage your account details and external integrations.
          </p>
        </div>

        {/* Profile Card */}
        <div className="glass rounded-2xl p-6 border border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-white font-bold text-lg shadow-inner">
              {isSessionPending
                ? "…"
                : sessionData?.user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            {isSessionPending ? (
              <div className="space-y-2">
                <div className="h-4 w-28 rounded bg-bg-surface animate-pulse-subtle" />
                <div className="h-3.5 w-40 rounded bg-bg-surface animate-pulse-subtle" />
              </div>
            ) : sessionData?.user ? (
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {sessionData.user.name}
                </h2>
                <p className="text-xs text-text-tertiary">{sessionData.user.email}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-accent-danger font-medium">Not logged in</p>
              </div>
            )}
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSignOut}
            disabled={isSessionPending}
            className="cursor-pointer font-medium tracking-wide sm:w-auto w-full"
          >
            Sign Out
          </Button>
        </div>
        {/* Signature Settings Card */}
        {sessionData?.user && (
          <div className="glass rounded-2xl border border-border-default overflow-hidden animate-fade-in">
            <div className="border-b border-border-subtle p-5 bg-bg-raised/40">
              <h2 className="text-base font-semibold text-text-primary">Email Signature Settings</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Configure your alias name to automatically inject into email composer drafts.
              </p>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  Your Name / Signature Alias
                </label>
                {isEditingUsername || !dbUsername ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="e.g. Rushil Parmar"
                      className="flex-1 bg-bg-surface border border-border-default rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
                    />
                    <div className="flex gap-2">
                      {dbUsername && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setUsernameInput(dbUsername);
                            setIsEditingUsername(false);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setUsernameMutation.mutate({ username: usernameInput });
                        }}
                        isLoading={setUsernameMutation.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-bg-surface/50 border border-border-subtle rounded-[var(--radius-md)] px-3 py-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {dbUsername}
                    </span>
                    <button
                      onClick={() => setIsEditingUsername(true)}
                      className="text-xs font-semibold text-accent-primary hover:underline cursor-pointer"
                    >
                      Change Name
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Priority Rules Card */}
        {sessionData?.user && (
          <div className="glass rounded-2xl border border-border-default overflow-hidden animate-fade-in">
            <div className="border-b border-border-subtle p-5 bg-bg-raised/40">
              <h2 className="text-base font-semibold text-text-primary">Inbox Priority Instructions</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Define what emails you consider priority. The AI prioritizer will automatically prioritize your inbox based on these rules.
              </p>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Custom Priority Instructions
                  </label>
                  {!isEditingPriority && dbPriorityRules && (
                    <button
                      onClick={() => setIsEditingPriority(true)}
                      className="text-xs font-semibold text-accent-primary hover:underline cursor-pointer"
                    >
                      Edit Instructions
                    </button>
                  )}
                </div>

                {isEditingPriority || !dbPriorityRules ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={priorityInput}
                      onChange={(e) => setPriorityInput(e.target.value)}
                      placeholder="e.g. emails from clients, bank statements, messages containing 'invoice' or 'hiring'"
                      rows={3}
                      className="w-full text-xs bg-bg-surface border border-border-default rounded-[var(--radius-md)] p-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none leading-relaxed font-medium"
                    />
                    <div className="flex gap-2 justify-end">
                      {dbPriorityRules && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPriorityInput(dbPriorityRules);
                            setIsEditingPriority(false);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setRulesMutation.mutate({ rules: priorityInput });
                        }}
                        isLoading={setRulesMutation.isPending}
                      >
                        Save Rules
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-bg-surface/50 border border-border-subtle rounded-[var(--radius-md)] p-3 text-xs text-text-secondary italic leading-relaxed font-medium">
                    "{dbPriorityRules}"
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Model Behavior Settings Card */}
        {sessionData?.user && (
          <div className="glass rounded-2xl border border-border-default overflow-hidden animate-fade-in">
            <div className="border-b border-border-subtle p-5 bg-bg-raised/40">
              <h2 className="text-base font-semibold text-text-primary">AI Agent Behavior</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Configure how the AI agent handles actions like sending emails or scheduling events.
              </p>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  Operation Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Careful Mode */}
                  <button
                    type="button"
                    onClick={() => setModelModeMutation.mutate({ mode: "careful" })}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer bg-bg-surface/30 ${
                      dbModelMode === "careful"
                        ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                        : "border-border-default text-text-secondary hover:bg-bg-surface/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Careful Mode (Review Drafts)
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-1.5 leading-relaxed">
                      Default. The agent will always ask for your review or save a draft in Gmail before executing any write actions. Ideal for safety.
                    </p>
                  </button>

                  {/* Autonomous Mode */}
                  <button
                    type="button"
                    onClick={() => setModelModeMutation.mutate({ mode: "autonomous" })}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer bg-bg-surface/30 ${
                      dbModelMode === "autonomous"
                        ? "border-accent-primary bg-accent-primary/5 text-text-primary"
                        : "border-border-default text-text-secondary hover:bg-bg-surface/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      Autonomous Mode (Autopilot)
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-1.5 leading-relaxed">
                      The agent will execute write actions (sending emails, scheduling calendar events) directly when instructed. It will still ask questions if requirements are vague or ambiguous.
                    </p>
                  </button>
                </div>
                {setModelModeMutation.isPending && (
                  <p className="text-[10px] text-accent-primary animate-pulse mt-1 font-medium">Updating agent settings...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Billing / Subscription Card */}
        {sessionData?.user && (
          <div className="glass rounded-2xl border border-border-default overflow-hidden animate-fade-in">
            <div className="border-b border-border-subtle p-5 bg-bg-raised/40">
              <h2 className="text-base font-semibold text-text-primary">Subscription & Billing</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Manage your billing tier, invoices, and payment methods.
              </p>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {isBillingLoading ? (
                      <span className="inline-block h-4 w-28 rounded bg-bg-surface animate-pulse-subtle" />
                    ) : subscription ? (
                      "Singularity Premium"
                    ) : (
                      "Free Tier"
                    )}
                  </h3>
                  <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                    {isBillingLoading ? (
                      <span className="inline-block h-3.5 w-48 rounded bg-bg-surface animate-pulse-subtle" />
                    ) : subscription ? (
                      `Next billing date: ${new Date(subscription.next_billing_date).toLocaleDateString()}`
                    ) : (
                      "Upgrade to unlock full AI Co-Pilot integrations, Gmail, and Calendar sync limits."
                    )}
                  </p>
                </div>
                <div className="shrink-0 sm:w-auto w-full flex gap-2.5">
                  {isBillingLoading ? (
                    <div className="h-8 w-24 rounded bg-bg-surface animate-pulse-subtle" />
                  ) : subscription ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="cursor-pointer font-semibold sm:w-auto w-full"
                      onClick={handleOpenBillingPortal}
                    >
                      Manage Billing
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="cursor-pointer font-semibold sm:w-auto w-full"
                      onClick={handleUpgrade}
                    >
                      Upgrade to Premium
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Card */}
        <div className="glass rounded-2xl border border-border-default overflow-hidden">
          <div className="border-b border-border-subtle p-5 bg-bg-raised/40">
            <h2 className="text-base font-semibold text-text-primary">Integrations</h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Connect Singularity to your email and calendar providers.
            </p>
          </div>

          <div className="divide-y divide-border-subtle">
            {/* Gmail integration row */}
            <div className="p-5 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle text-text-primary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-text-primary">Gmail</h3>
                  <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                    Access and manage your email threads, prioritize key messages.
                  </p>
                  {gmailStatus?.connected && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-[200px] sm:max-w-xs">
                        Connected to {gmailStatus.emailAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 sm:w-auto w-full mt-2 sm:mt-0">
                {isGmailLoading ? (
                  <div className="h-8 w-20 rounded bg-bg-surface animate-pulse-subtle" />
                ) : gmailStatus?.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:w-auto w-full hover:bg-accent-danger/10 hover:text-accent-danger border border-border-default hover:border-accent-danger/25"
                    onClick={() => handleDisconnect("gmail")}
                    isLoading={disconnectGmail.isPending}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="sm:w-auto w-full font-semibold border-neutral-700 hover:bg-text-primary hover:text-bg-base"
                    onClick={() => handleConnect("gmail")}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Calendar integration row */}
            <div className="p-5 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle text-text-primary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-text-primary">Google Calendar</h3>
                  <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                    Sync your agenda, view upcoming meetings, and plan your schedule.
                  </p>
                  {calendarStatus?.connected && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-[200px] sm:max-w-xs">
                        Connected to {calendarStatus.emailAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 sm:w-auto w-full mt-2 sm:mt-0">
                {isCalendarLoading ? (
                  <div className="h-8 w-20 rounded bg-bg-surface animate-pulse-subtle" />
                ) : calendarStatus?.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:w-auto w-full hover:bg-accent-danger/10 hover:text-accent-danger border border-border-default hover:border-accent-danger/25"
                    onClick={() => handleDisconnect("googlecalendar")}
                    isLoading={disconnectCalendar.isPending}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="sm:w-auto w-full font-semibold border-neutral-700 hover:bg-text-primary hover:text-bg-base"
                    onClick={() => handleConnect("googlecalendar")}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
