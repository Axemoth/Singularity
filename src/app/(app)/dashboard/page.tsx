"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/app/_components/ui/button";

function formatEventTime(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  const isAllDay = startStr.length === 10;
  if (isAllDay) {
    return start.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + " (All Day)";
  }

  const datePart = start.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
  const startTimePart = start.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
  const endTimePart = end.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
  
  if (start.toDateString() === end.toDateString()) {
    return `${datePart}, ${startTimePart} - ${endTimePart}`;
  } else {
    return `${datePart}, ${startTimePart} - ${end.toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}, ${endTimePart}`;
  }
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [emailFilter, setEmailFilter] = useState<string>("all");

  // Get current local date strings
  const getDates = () => {
    const now = new Date();
    let start: Date;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (timeRange === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (timeRange === "7d") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
    } else if (timeRange === "30d") {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
    } else {
      start = customStart ? new Date(customStart) : new Date();
      start.setHours(0, 0, 0, 0);
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
    }
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const { startDate, endDate } = getDates();

  // Fetch connection statuses
  const { data: gmailStatus, isLoading: isGmailLoading } = api.gmail.getConnectionStatus.useQuery();
  const { data: calendarStatus, isLoading: isCalendarLoading } = api.calendar.getConnectionStatus.useQuery();

  // Combine unique connected email addresses for filtering
  const allEmails = Array.from(
    new Set([
      ...(gmailStatus?.accounts?.map((a: any) => a.emailAddress) ?? []),
      ...(calendarStatus?.accounts?.map((a: any) => a.emailAddress) ?? []),
    ])
  ).filter(Boolean) as string[];

  // Fetch dashboard metrics
  const { data: metrics, isLoading: isMetricsLoading, isError } = api.dashboard.getMetrics.useQuery(
    { startDate, endDate, emailFilter },
    {
      enabled: !!gmailStatus && !!calendarStatus,
      refetchInterval: 30000, // Refresh counts every 30s
    }
  );

  const handleConnect = (plugin: "gmail" | "googlecalendar") => {
    window.location.href = `/api/connect?plugin=${plugin}`;
  };

  const isGmailConnected = gmailStatus?.connected === true;
  const isCalendarConnected = calendarStatus?.connected === true;

  const showLoading = isGmailLoading || isCalendarLoading || isMetricsLoading;

  return (
    <div className="min-h-screen bg-bg-base p-6 md:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight font-sans">Dashboard</h1>
          <p className="text-sm text-text-tertiary mt-1">
            An overview of your inbox activity and upcoming calendar events.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Email Filter Dropdown */}
          {allEmails.length > 1 && (
            <select
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="bg-bg-raised text-text-primary border border-border-default rounded-xl px-3 py-1.5 text-xs outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary cursor-pointer font-semibold self-start"
              aria-label="Filter by account"
            >
              <option value="all">All Accounts ({allEmails.length})</option>
              {allEmails.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          )}

          <div className="flex bg-bg-surface/50 p-1 rounded-xl border border-border-default/50 self-start">
            {(["today", "7d", "30d", "custom"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimeRange(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  timeRange === mode
                    ? "bg-bg-raised text-text-primary shadow-sm border border-border-default"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {mode === "7d" ? "Last 7 Days" : mode === "30d" ? "Last 30 Days" : mode}
              </button>
            ))}
          </div>

          {timeRange === "custom" && (
            <div className="flex items-center gap-2 animate-scale-in">
              <input
                type="date"
                value={customStart}
                aria-label="Start date"
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-bg-raised text-text-primary border border-border-default rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
              />
              <span className="text-xs text-text-tertiary">to</span>
              <input
                type="date"
                value={customEnd}
                aria-label="End date"
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-bg-raised text-text-primary border border-border-default rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Sent Emails */}
        <div className="bg-bg-raised border border-border-default rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-bold text-text-tertiary tracking-wider">Sent Emails</span>
              <div className="h-8 w-8 rounded-lg bg-accent-info/10 text-accent-info flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </div>
            </div>

            {!isGmailConnected ? (
              <div className="text-xs text-text-tertiary mt-2">
                Gmail account not connected.
              </div>
            ) : showLoading ? (
              <div className="h-8 w-16 bg-bg-surface animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-extrabold text-text-primary tracking-tight">
                {metrics?.sentCount ?? 0}
              </div>
            )}
          </div>

          {!isGmailConnected && (
            <Button
              onClick={() => handleConnect("gmail")}
              className="mt-4 w-full bg-accent-primary text-text-inverse hover:bg-accent-primary-hover font-semibold py-2 rounded-xl text-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Connect Gmail
            </Button>
          )}
        </div>

        {/* Card 2: Unread Emails */}
        <div className="bg-bg-raised border border-border-default rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-bold text-text-tertiary tracking-wider">Unread Emails</span>
              <div className="h-8 w-8 rounded-lg bg-accent-warning/10 text-accent-warning flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0l-7.5-4.615a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
            </div>

            {!isGmailConnected ? (
              <div className="text-xs text-text-tertiary mt-2">
                Gmail account not connected.
              </div>
            ) : showLoading ? (
              <div className="h-8 w-16 bg-bg-surface animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-extrabold text-text-primary tracking-tight">
                {metrics?.unreadCount ?? 0}
              </div>
            )}
          </div>

          {!isGmailConnected && (
            <Button
              onClick={() => handleConnect("gmail")}
              className="mt-4 w-full bg-accent-primary text-text-inverse hover:bg-accent-primary-hover font-semibold py-2 rounded-xl text-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Connect Gmail
            </Button>
          )}
        </div>

        {/* Card 3: Scheduled Events Count */}
        <div className="bg-bg-raised border border-border-default rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-bold text-text-tertiary tracking-wider">Scheduled Events</span>
              <div className="h-8 w-8 rounded-lg bg-accent-success/10 text-accent-success flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
            </div>

            {!isCalendarConnected ? (
              <div className="text-xs text-text-tertiary mt-2">
                Google Calendar not connected.
              </div>
            ) : showLoading ? (
              <div className="h-8 w-16 bg-bg-surface animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-extrabold text-text-primary tracking-tight">
                {metrics?.scheduledEvents?.length ?? 0}
              </div>
            )}
          </div>

          {!isCalendarConnected && (
            <Button
              onClick={() => handleConnect("googlecalendar")}
              className="mt-4 w-full bg-accent-primary text-text-inverse hover:bg-accent-primary-hover font-semibold py-2 rounded-xl text-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Connect Calendar
            </Button>
          )}
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-bg-raised border border-border-default rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4 font-sans flex items-center gap-2">
          <span>Scheduled Events Timeline</span>
          {showLoading && (
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-ping" />
          )}
        </h2>

        {!isCalendarConnected ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border-default rounded-xl bg-bg-surface/10 p-6">
            <div className="h-12 w-12 rounded-full bg-bg-surface text-text-tertiary flex items-center justify-center mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Google Calendar is Disconnected</h3>
            <p className="text-xs text-text-tertiary mt-1 max-w-sm">
              Connect your Google Calendar account to sync, monitor, and manage your meetings and schedules.
            </p>
            <Button
              onClick={() => handleConnect("googlecalendar")}
              className="mt-4 bg-accent-primary text-text-inverse hover:bg-accent-primary-hover font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
            >
              Connect Calendar
            </Button>
          </div>
        ) : showLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex gap-4 p-4 border border-border-subtle rounded-xl bg-bg-surface/20 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-bg-surface rounded w-1/3" />
                  <div className="h-3 bg-bg-surface rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-xs text-accent-danger text-center py-6">
            Failed to load dashboard metrics. Please refresh the page.
          </div>
        ) : !metrics?.scheduledEvents || metrics.scheduledEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border-default rounded-xl bg-bg-surface/10 p-6">
            <div className="h-12 w-12 rounded-full bg-bg-surface text-text-tertiary flex items-center justify-center mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-text-primary font-sans">All Clear!</h3>
            <p className="text-xs text-text-tertiary mt-1 max-w-sm">
              No calendar events are scheduled for this selected time range.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {metrics.scheduledEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border-subtle rounded-xl bg-bg-surface/20 hover:bg-bg-surface/40 hover:border-border-default transition-all"
              >
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-text-primary font-sans">{event.summary}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary mt-1">
                    <span className="flex items-center gap-1.5 text-text-secondary font-medium">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatEventTime(event.start, event.end)}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <span>•</span>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span className="truncate max-w-[200px]">{event.location}</span>
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-text-tertiary mt-2 line-clamp-2 italic">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
