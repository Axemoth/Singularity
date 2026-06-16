"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/app/_components/ui/button";
import { Badge } from "@/app/_components/ui/badge";
import { SearchInput } from "@/app/_components/ui/search-input";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatEventTime(start: any, end: any): string {
  if (start?.date) return "All day";
  if (!start?.dateTime) return "";
  const s = new Date(start.dateTime);
  const e = end?.dateTime ? new Date(end.dateTime) : null;
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return e ? `${fmt(s)} — ${fmt(e)}` : fmt(s);
}

function getEventDateKey(event: CalendarEvent): string {
  const dt = event.data?.start?.dateTime || event.data?.start?.date;
  if (!dt) return "Unknown";
  const d = new Date(dt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateHeading(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toKey = (dt: Date) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  const todayKey = toKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = toKey(tomorrow);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = toKey(yesterday);

  if (dateKey === todayKey) return "Today";
  if (dateKey === tomorrowKey) return "Tomorrow";
  if (dateKey === yesterdayKey) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getEventSortTime(event: CalendarEvent): number {
  const dt = event.data?.start?.dateTime || event.data?.start?.date;
  if (!dt) return 0;
  return new Date(dt).getTime();
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEventData {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
  htmlLink?: string;
}

interface CalendarEvent {
  id: string;
  entityId: string;
  data: CalendarEventData;
  updatedAt: Date;
}

interface DateGroup {
  dateKey: string;
  heading: string;
  events: CalendarEvent[];
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function EventSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((group) => (
        <div key={group} className="space-y-3">
          <div className="h-5 w-28 rounded bg-bg-surface" />
          {[1, 2].map((item) => (
            <div
              key={item}
              className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-raised p-4"
            >
              <div className="flex gap-4">
                <div className="h-4 w-24 rounded bg-bg-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-bg-surface" />
                  <div className="h-3 w-32 rounded bg-bg-surface" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Event Card ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const data = event.data;
  const title = data.summary || "Untitled Event";
  const time = formatEventTime(data.start, data.end);
  const isCancelled = data.status === "cancelled";
  const isTentative = data.status === "tentative";
  const attendeeCount = data.attendees?.length ?? 0;
  const description = data.description
    ? data.description.slice(0, 120) + (data.description.length > 120 ? "…" : "")
    : null;

  return (
    <a
      href={data.htmlLink ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-[var(--radius-md)] border border-border-subtle bg-bg-raised p-4 transition-colors duration-[var(--transition-fast)] hover:border-border-default ${
        data.htmlLink ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex gap-4">
        {/* Time column */}
        <div className="w-28 shrink-0 pt-0.5 text-sm text-text-tertiary">
          {time}
        </div>

        {/* Details column */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Title + status badges */}
          <div className="flex items-center gap-2">
            <h3
              className={`truncate text-sm font-medium text-text-primary ${
                isCancelled ? "line-through opacity-60" : ""
              }`}
            >
              {title}
            </h3>
            {isCancelled && <Badge>Cancelled</Badge>}
            {isTentative && <Badge>Tentative</Badge>}
          </div>

          {/* Location */}
          {data.location && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <MapPinIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{data.location}</span>
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-xs leading-relaxed text-text-tertiary">
              {description}
            </p>
          )}

          {/* Attendees */}
          {attendeeCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <UsersIcon className="h-3 w-3 shrink-0" />
              <span>
                {attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Date Group ────────────────────────────────────────────────────────────────

function DateGroupSection({ group }: { group: DateGroup }) {
  const isToday = group.heading === "Today";

  return (
    <section className="animate-fade-in">
      {/* Group heading */}
      <div
        className={`mb-3 flex items-center gap-3 ${
          isToday ? "border-l-2 border-accent-primary pl-3" : "pl-[14px]"
        }`}
      >
        <h2
          className={`text-sm font-semibold ${
            isToday ? "text-text-primary" : "text-text-secondary"
          }`}
        >
          {group.heading}
        </h2>
        <span className="text-xs text-text-tertiary">
          {group.events.length} event{group.events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        {group.events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  eventsByDate,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
}) {
  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [startOfWeek]);

  const getDayKey = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const todayStr = getDayKey(new Date());

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none animate-fade-in -mx-6 px-6 md:mx-0 md:px-0">
      {weekDays.map((day) => {
        const key = getDayKey(day);
        const dayEvents = eventsByDate.get(key) ?? [];
        const isToday = key === todayStr;
        const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
        const dateNum = day.getDate();

        const sortedEvents = [...dayEvents].sort(
          (a, b) => getEventSortTime(a) - getEventSortTime(b)
        );

        return (
          <div
            key={key}
            className={`min-w-[155px] flex-1 bg-bg-raised border rounded-[var(--radius-lg)] p-3 flex flex-col gap-3 min-h-[400px] shadow-sm ${
              isToday ? "border-accent-primary bg-bg-surface/30" : "border-border-subtle"
            }`}
          >
            {/* Header */}
            <div className="flex flex-col items-center gap-1 pb-2 border-b border-border-subtle shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                {dayName}
              </span>
              <span
                className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-accent-primary text-text-inverse"
                    : "text-text-primary"
                }`}
              >
                {dateNum}
              </span>
            </div>

            {/* Events */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[350px]">
              {sortedEvents.length > 0 ? (
                sortedEvents.map((event) => {
                  const title = event.data.summary || "Untitled Event";
                  const time = formatEventTime(event.data.start, event.data.end);
                  return (
                    <a
                      key={event.id}
                      href={event.data.htmlLink ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 bg-bg-surface hover:bg-bg-inset border border-border-subtle hover:border-border-default rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)] text-left"
                    >
                      <div className="text-[9px] text-accent-info font-bold mb-0.5">
                        {time}
                      </div>
                      <div className="text-xs font-semibold text-text-primary leading-tight line-clamp-2" title={title}>
                        {title}
                      </div>
                      {event.data.location && (
                        <div className="text-[9px] text-text-tertiary mt-1 truncate" title={event.data.location}>
                          📍 {event.data.location}
                        </div>
                      )}
                    </a>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] text-text-tertiary italic">No events</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  eventsByDate,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
}) {
  const monthCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOfWeekDay = firstDay.getDay(); // 0 = Sun
    const totalMonthDays = lastDay.getDate();

    const cells = [];

    // Prefix days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOfWeekDay - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Month days
    for (let i = 1; i <= totalMonthDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Suffix days to fill grid
    const totalCells = cells.length <= 35 ? 35 : 42;
    const nextDaysNeeded = totalCells - cells.length;
    for (let i = 1; i <= nextDaysNeeded; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentDate]);

  const getDayKey = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const todayStr = getDayKey(new Date());
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col border border-border-subtle bg-bg-raised rounded-[var(--radius-lg)] overflow-hidden shadow-sm animate-fade-in">
      <div className="grid grid-cols-7 border-b border-border-subtle bg-bg-surface/50 text-center shrink-0">
        {weekdays.map((wd) => (
          <div key={wd} className="py-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-border-subtle">
        {monthCells.map((cell, idx) => {
          const key = getDayKey(cell.date);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === todayStr;
          const dateNum = cell.date.getDate();

          const sortedEvents = [...dayEvents].sort(
            (a, b) => getEventSortTime(a) - getEventSortTime(b)
          );

          return (
            <div
              key={`${key}-${idx}`}
              className={`min-h-[95px] p-2 flex flex-col gap-1.5 transition-colors duration-[var(--transition-fast)] ${
                cell.isCurrentMonth ? "bg-bg-raised" : "bg-bg-base/30 opacity-60"
              } ${isToday ? "bg-accent-primary/5" : ""}`}
            >
              <div className="flex justify-end shrink-0">
                <span
                  className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-accent-primary text-text-inverse"
                      : cell.isCurrentMonth
                      ? "text-text-primary"
                      : "text-text-tertiary"
                  }`}
                >
                  {dateNum}
                </span>
              </div>

              <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[60px] scrollbar-none">
                {sortedEvents.slice(0, 3).map((event) => {
                  const title = event.data.summary || "Untitled Event";
                  return (
                    <a
                      key={event.id}
                      href={event.data.htmlLink ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={title}
                      className="block truncate text-[9px] px-1.5 py-0.5 bg-bg-surface hover:bg-bg-inset border-l-2 border-accent-info text-text-secondary rounded font-medium text-left leading-tight"
                    >
                      {title}
                    </a>
                  );
                })}
                {sortedEvents.length > 3 && (
                  <span className="text-[8px] font-bold text-text-tertiary text-right pr-0.5">
                    +{sortedEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"list" | "week" | "month">("list");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const utils = api.useUtils();
  const { data: calendarStatus, isLoading: isStatusLoading } = api.calendar.getConnectionStatus.useQuery();
  const {
    data: events,
    isLoading: isEventsLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = api.calendar.listEvents.useQuery({ refresh: false });

  const isLoading = isEventsLoading || isStatusLoading;

  // Filter and group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!events || !Array.isArray(events)) return map;

    const query = searchQuery.trim().toLowerCase();
    const filtered = (events as CalendarEvent[]).filter((event) => {
      if (!query) return true;
      const summary = (event.data?.summary ?? "").toLowerCase();
      const description = (event.data?.description ?? "").toLowerCase();
      const location = (event.data?.location ?? "").toLowerCase();
      const attendees = (event.data?.attendees ?? [])
        .map((a) => a.email ?? "")
        .join(" ")
        .toLowerCase();

      return (
        summary.includes(query) ||
        description.includes(query) ||
        location.includes(query) ||
        attendees.includes(query)
      );
    });

    for (const event of filtered) {
      const key = getEventDateKey(event);
      const existing = map.get(key);
      if (existing) {
        existing.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [events, searchQuery]);

  // List view groups
  const groups = useMemo<DateGroup[]>(() => {
    const sorted = Array.from(eventsByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, evts]) => ({
        dateKey,
        heading: formatDateHeading(dateKey),
        events: evts.sort(
          (a, b) => getEventSortTime(b) - getEventSortTime(a),
        ),
      }));

    return sorted;
  }, [eventsByDate]);

  const totalEvents = events?.length ?? 0;

  const handleRefresh = async () => {
    await utils.calendar.getConnectionStatus.invalidate();
    await utils.calendar.listEvents.invalidate();
    refetch();
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-text-secondary" />
            <h1 className="text-xl font-semibold text-text-primary">
              Calendar
            </h1>
            {!isLoading && totalEvents > 0 && (
              <span className="text-sm text-text-tertiary">
                {totalEvents} event{totalEvents !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {calendarStatus?.connected && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                Create Event
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              isLoading={isFetching}
              disabled={isFetching || !calendarStatus?.connected}
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        {/* Date Navigation & View Switcher */}
        {!isLoading && !isError && calendarStatus?.connected && totalEvents > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
            {view !== "list" ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0 flex items-center justify-center font-bold text-xs"
                  onClick={handlePrev}
                >
                  &larr;
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 text-xs font-semibold"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0 flex items-center justify-center font-bold text-xs"
                  onClick={handleNext}
                >
                  &rarr;
                </Button>
                <span className="text-sm font-semibold text-text-primary ml-2 tabular-nums">
                  {view === "month"
                    ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    : (() => {
                        const start = new Date(currentDate);
                        start.setDate(currentDate.getDate() - currentDate.getDay());
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);
                        const optionsStart: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
                        const optionsEnd: Intl.DateTimeFormatOptions = {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        };
                        if (start.getFullYear() !== end.getFullYear()) {
                          optionsStart.year = "numeric";
                        }
                        return `${start.toLocaleDateString("en-US", optionsStart)} – ${end.toLocaleDateString("en-US", optionsEnd)}`;
                      })()}
                </span>
              </div>
            ) : (
              <div className="text-sm font-semibold text-text-primary py-1">
                Upcoming Schedule
              </div>
            )}

            <div className="flex bg-bg-raised border border-border-subtle rounded-[var(--radius-md)] p-1 gap-1 shrink-0 self-start sm:self-auto shadow-sm">
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-sm)] cursor-pointer transition-all duration-[var(--transition-fast)] ${
                  view === "list"
                    ? "bg-bg-surface text-text-primary border border-border-default shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-sm)] cursor-pointer transition-all duration-[var(--transition-fast)] ${
                  view === "week"
                    ? "bg-bg-surface text-text-primary border border-border-default shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView("month")}
                className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-sm)] cursor-pointer transition-all duration-[var(--transition-fast)] ${
                  view === "month"
                    ? "bg-bg-surface text-text-primary border border-border-default shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                Month
              </button>
            </div>
          </div>
        )}

        {/* Search Input Bar */}
        {!isLoading && !isError && totalEvents > 0 && (
          <div className="mb-6 animate-fade-in">
            <SearchInput
              placeholder="Search meetings, locations, attendees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              className="w-full"
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && <EventSkeleton />}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="animate-fade-in rounded-[var(--radius-md)] border border-border-subtle bg-bg-raised p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-danger/10">
              <svg
                className="h-5 w-5 text-accent-danger"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-medium text-text-primary">
              Failed to load events
            </p>
            <p className="mb-4 text-xs text-text-tertiary">
              {error?.message || "Something went wrong. Please try again."}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Disconnected state */}
        {!isLoading && !isError && !calendarStatus?.connected && (
          <div className="animate-fade-in rounded-[var(--radius-md)] border border-border-subtle bg-bg-raised p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-bg-surface">
              <CalendarIcon className="h-5 w-5 text-text-tertiary" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-primary">
              Calendar is not connected
            </p>
            <p className="mb-4 text-xs text-text-tertiary leading-relaxed max-w-sm mx-auto">
              Authorize Singularity to access your Google Calendar and manage events.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="font-semibold"
              onClick={() => {
                window.location.href = "/api/connect?plugin=googlecalendar";
              }}
            >
              Connect Calendar
            </Button>
          </div>
        )}

        {/* Connected but empty state */}
        {!isLoading && !isError && calendarStatus?.connected && totalEvents === 0 && (
          <div className="animate-fade-in rounded-[var(--radius-md)] border border-border-subtle bg-bg-raised p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-bg-surface">
              <CalendarIcon className="h-5 w-5 text-text-tertiary" />
            </div>
            <p className="mb-1 text-sm font-medium text-text-primary">
              No events found
            </p>
            <p className="mb-4 text-xs text-text-tertiary leading-relaxed">
              Connected as {calendarStatus?.emailAddress}. Sync your calendar to import events.
            </p>
            <Button variant="secondary" size="sm" onClick={handleRefresh} isLoading={isFetching}>
              <RefreshIcon className="h-3.5 w-3.5" />
              Sync Calendar
            </Button>
          </div>
        )}

        {/* Views */}
        {!isLoading && !isError && totalEvents > 0 && (
          <>
            {view === "list" && groups.length > 0 && (
              <div className="space-y-8">
                {groups.map((group) => (
                  <DateGroupSection key={group.dateKey} group={group} />
                ))}
              </div>
            )}

            {view === "week" && (
              <WeekView currentDate={currentDate} eventsByDate={eventsByDate} />
            )}

            {view === "month" && (
              <MonthView currentDate={currentDate} eventsByDate={eventsByDate} />
            )}

            {groups.length === 0 && (
              <div className="animate-fade-in rounded-[var(--radius-md)] border border-border-subtle bg-bg-raised p-8 text-center">
                <p className="text-sm font-medium text-text-primary">No results found</p>
                <p className="text-xs text-text-tertiary mt-1">
                  No calendar events match "{searchQuery}"
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <CreateEventModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onEventCreated={() => {
          void utils.calendar.listEvents.invalidate();
        }}
      />
    </div>
  );
}

function CreateEventModal({
  isOpen,
  onClose,
  onEventCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  
  // Form Fields
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  
  // Set default start/end dates to today, start time to next hour
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [endTime, setEndTime] = useState("11:00");
  
  const [attendees, setAttendees] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // AI Form State
  const [aiText, setAiText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const createMutation = api.calendar.createEvent.useMutation({
    onSuccess: async () => {
      onEventCreated();
      onClose();
      resetForm();
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const chatMutation = api.agent.chat.useMutation({
    onSuccess: (data) => {
      setIsAiLoading(false);
      try {
        let cleanText = data.text;
        const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
        cleanText = cleanText.replace(thinkRegex, "").trim();

        const jsonMatch = cleanText.match(/```json([\s\S]*?)```/i);
        const jsonStr = jsonMatch ? jsonMatch[1] : cleanText;
        const parsed = JSON.parse(jsonStr!.trim());

        if (parsed.summary) setSummary(parsed.summary);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.location) setLocation(parsed.location);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.startTime) setStartTime(parsed.startTime);
        if (parsed.endDate) setEndDate(parsed.endDate);
        if (parsed.endTime) setEndTime(parsed.endTime);
        if (parsed.attendees && Array.isArray(parsed.attendees)) {
          setAttendees(parsed.attendees.join(", "));
        }
        
        setActiveTab("manual");
        setAiText("");
      } catch (err) {
        console.error("Failed to parse AI response for calendar event:", err);
        setErrorMsg("Failed to parse AI response. Please try describing it differently or use the manual form.");
      }
    },
    onError: (err) => {
      setIsAiLoading(false);
      setErrorMsg(`AI Drafting failed: ${err.message}`);
    },
  });

  const resetForm = () => {
    setSummary("");
    setDescription("");
    setLocation("");
    setAttendees("");
    setErrorMsg("");
    setAiText("");
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setStartDate(dateStr);
    setEndDate(dateStr);
    setStartTime("10:00");
    setEndTime("11:00");
  };

  const handleSave = () => {
    if (!summary) {
      setErrorMsg("Summary is required.");
      return;
    }
    setErrorMsg("");

    const startISO = `${startDate}T${startTime}:00`;
    const endISO = `${endDate}T${endTime}:00`;

    const attendeeEmails = attendees
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    createMutation.mutate({
      summary,
      description: description || undefined,
      location: location || undefined,
      start: startISO,
      end: endISO,
      attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
    });
  };

  const handleAiDraft = () => {
    if (!aiText.trim()) return;
    setErrorMsg("");
    setIsAiLoading(true);

    const now = new Date();
    const prompt = `Translate this natural language event request into a structured JSON object.
Request: "${aiText}"
Current local time reference: ${now.toISOString()} (Today is ${now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})

Output ONLY a JSON block wrapped in \`\`\`json and \`\`\` containing:
{
  "summary": "...",
  "description": "...",
  "location": "...",
  "startDate": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endDate": "YYYY-MM-DD",
  "endTime": "HH:MM",
  "attendees": ["email1@example.com", ...]
}
Do not output any conversational text, notes, markdown formatting other than the json block.`;

    chatMutation.mutate({
      message: prompt,
      history: [],
      context: {
        route: "/calendar",
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-bg-raised border border-border-default rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        {/* Header */}
        <div className="border-b border-border-subtle p-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Create Event</h2>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer p-1"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-4 pb-2 border-b border-border-subtle bg-bg-raised/10 shrink-0">
          <div className="flex bg-bg-inset border border-border-subtle rounded-xl p-1 gap-1 w-full shadow-inner">
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-[var(--transition-fast)] ${
                activeTab === "manual"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-xs"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Manual Form
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-[var(--transition-fast)] ${
                activeTab === "ai"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-xs"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Draft with AI
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/35 text-red-400 p-3 rounded-xl text-xs font-semibold animate-fade-in leading-relaxed">
              {errorMsg}
            </div>
          )}

          {activeTab === "ai" ? (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Describe Event</label>
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="e.g. Lunch with Sarah tomorrow at 1:00 PM to 2:00 PM at Olive Garden..."
                  rows={4}
                  className="w-full resize-none border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3.5 py-2.5 text-xs rounded-xl transition-all font-medium leading-relaxed"
                />
              </div>
              <Button
                onClick={handleAiDraft}
                isLoading={isAiLoading}
                disabled={isAiLoading || !aiText.trim()}
                className="w-full font-bold uppercase tracking-wider text-xs h-10 cursor-pointer"
              >
                Generate Event Details
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 animate-fade-in">
              {/* Summary */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Event title"
                  className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3.5 py-2 text-xs rounded-xl transition-colors font-semibold"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-xl transition-colors font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-xl transition-colors font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-xl transition-colors font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-xl transition-colors font-medium"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Zoom, Office, Cafe..."
                  className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3.5 py-2 text-xs rounded-xl transition-colors font-medium"
                />
              </div>

              {/* Attendees */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Attendees (Optional)</label>
                <input
                  type="text"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="e.g. sarah@example.com, bob@example.com"
                  className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3.5 py-2 text-xs rounded-xl transition-colors font-medium"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event description..."
                  rows={3}
                  className="w-full resize-none border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3.5 py-2 text-xs rounded-xl transition-colors font-medium leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border-subtle p-4 flex items-center gap-2 shrink-0 bg-bg-raised/10">
          <Button
            variant="secondary"
            className="flex-1 font-bold text-xs h-9 cursor-pointer"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          {activeTab === "manual" && (
            <Button
              className="flex-1 font-bold uppercase tracking-wider text-xs h-9 cursor-pointer"
              onClick={handleSave}
              isLoading={createMutation.isPending}
            >
              Save Event
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
