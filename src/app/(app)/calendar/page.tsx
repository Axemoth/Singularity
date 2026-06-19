"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/app/_components/ui/button";
import { Badge } from "@/app/_components/ui/badge";
import { SearchInput } from "@/app/_components/ui/search-input";
import { useToast } from "@/app/_components/ui/toast";

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
  return e ? `${fmt(s)} - ${fmt(e)}` : fmt(s);
}

function toLocalOffsetDateTime(date: string, time: string): string {
  const localDate = new Date(`${date}T${time}:00`);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");
  return `${date}T${time}:00${sign}${offsetHours}:${offsetMins}`;
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
  emailAddress?: string;
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
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function EventSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((group) => (
        <div key={group} className="space-y-3">
          <div className="bg-bg-surface h-5 w-28 rounded" />
          {[1, 2].map((item) => (
            <div
              key={item}
              className="border-border-subtle bg-bg-raised rounded-[var(--radius-md)] border p-4"
            >
              <div className="flex gap-4">
                <div className="bg-bg-surface h-4 w-24 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="bg-bg-surface h-4 w-48 rounded" />
                  <div className="bg-bg-surface h-3 w-32 rounded" />
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

function EventCard({
  event,
  onDelete,
  isDeleting,
}: {
  event: CalendarEvent;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const data = event.data;
  const title = data.summary || "Untitled Event";
  const time = formatEventTime(data.start, data.end);
  const isCancelled = data.status === "cancelled";
  const isTentative = data.status === "tentative";
  const attendeeCount = data.attendees?.length ?? 0;
  const description = data.description
    ? data.description.slice(0, 120) +
      (data.description.length > 120 ? "..." : "")
    : null;

  return (
    <a
      href={data.htmlLink ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`group border-border-subtle bg-bg-raised hover:border-border-default relative block rounded-[var(--radius-md)] border p-4 transition-colors duration-[var(--transition-fast)] ${
        data.htmlLink ? "cursor-pointer" : "cursor-default"
      } ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="flex gap-4">
        {/* Time column */}
        <div className="text-text-tertiary w-28 shrink-0 pt-0.5 text-sm">
          {time}
        </div>

        {/* Details column */}
        <div className="min-w-0 flex-1 space-y-1.5 pr-8">
          {/* Title + status badges */}
          <div className="flex items-center gap-2">
            <h3
              className={`text-text-primary truncate text-sm font-medium ${
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
            <div className="text-text-secondary flex items-center gap-1.5 text-xs">
              <MapPinIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{data.location}</span>
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-text-tertiary text-xs leading-relaxed">
              {description}
            </p>
          )}

          {/* Attendees */}
          {attendeeCount > 0 && (
            <div className="text-text-tertiary flex items-center gap-1.5 text-xs">
              <UsersIcon className="h-3 w-3 shrink-0" />
              <span>
                {attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(event.entityId);
        }}
        disabled={isDeleting}
        className="text-text-tertiary hover:text-accent-danger hover:bg-accent-danger/10 absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer rounded-lg p-2 opacity-0 transition-all duration-[var(--transition-fast)] group-hover:opacity-100 focus:opacity-100"
        title="Delete Event"
      >
        {isDeleting ? (
          <SpinnerIcon className="h-4 w-4" />
        ) : (
          <TrashIcon className="h-4 w-4" />
        )}
      </button>
    </a>
  );
}

// ─── Date Group ────────────────────────────────────────────────────────────────

function DateGroupSection({
  group,
  onDelete,
  deletingIds,
}: {
  group: DateGroup;
  onDelete: (id: string) => void;
  deletingIds: Record<string, boolean>;
}) {
  const isToday = group.heading === "Today";

  return (
    <section className="animate-fade-in">
      {/* Group heading */}
      <div
        className={`mb-3 flex items-center gap-3 ${
          isToday ? "border-accent-primary border-l-2 pl-3" : "pl-[14px]"
        }`}
      >
        <h2
          className={`text-sm font-semibold ${
            isToday ? "text-text-primary" : "text-text-secondary"
          }`}
        >
          {group.heading}
        </h2>
        <span className="text-text-tertiary text-xs">
          {group.events.length} event{group.events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        {group.events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onDelete={onDelete}
            isDeleting={!!deletingIds[event.entityId]}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  eventsByDate,
  onDateClick,
  onDelete,
  deletingIds,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDateClick: (date: string) => void;
  onDelete: (id: string) => void;
  deletingIds: Record<string, boolean>;
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
    <div className="-mx-6 scrollbar-none overflow-x-auto px-6 md:mx-0 md:px-0">
      <div className="animate-fade-in grid min-w-[900px] grid-cols-7 gap-3 pb-2 md:min-w-0">
        {weekDays.map((day) => {
          const key = getDayKey(day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === todayStr;
          const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
          const dateNum = day.getDate();

          const sortedEvents = [...dayEvents].sort(
            (a, b) => getEventSortTime(a) - getEventSortTime(b),
          );

          return (
            <div
              key={key}
              onClick={(e) => {
                if (
                  (e.target as HTMLElement).closest("a") ||
                  (e.target as HTMLElement).closest("button")
                ) {
                  return;
                }
                onDateClick(key);
              }}
              className={`group bg-bg-raised/40 hover:bg-bg-raised relative flex min-h-[420px] cursor-pointer flex-col gap-3 rounded-[var(--radius-md)] border p-3 transition-all duration-[var(--transition-base)] hover:shadow-md ${
                isToday
                  ? "border-accent-info/40 bg-accent-info/[0.02]"
                  : "border-border-subtle/50"
              }`}
            >
              {isToday && (
                <div className="bg-accent-info absolute top-0 right-0 left-0 h-[3px] rounded-t-[var(--radius-md)]" />
              )}

              {/* Header */}
              <div className="border-border-subtle/40 flex shrink-0 flex-col items-center gap-1 border-b pb-2">
                <span className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                  {dayName}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isToday
                      ? "bg-accent-info text-text-inverse shadow-xs"
                      : "text-text-primary group-hover:text-accent-info"
                  }`}
                >
                  {dateNum}
                </span>
              </div>

              {/* Events */}
              <div className="flex max-h-[340px] flex-1 scrollbar-none flex-col gap-2 overflow-y-auto pr-0.5">
                {sortedEvents.length > 0 ? (
                  sortedEvents.map((event) => {
                    const title = event.data.summary || "Untitled Event";
                    const time = formatEventTime(
                      event.data.start,
                      event.data.end,
                    );
                    const isDeleting = !!deletingIds[event.entityId];
                    return (
                      <a
                        key={event.id}
                        href={event.data.htmlLink ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group/card bg-bg-surface/50 hover:bg-bg-surface border-border-subtle/60 hover:border-border-default relative block overflow-hidden rounded-[var(--radius-sm)] border p-2.5 text-left shadow-2xs transition-all duration-[var(--transition-fast)] hover:shadow-xs ${
                          isDeleting ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        {/* Left border indicator */}
                        <div className="bg-accent-info/70 group-hover/card:bg-accent-info absolute top-0 bottom-0 left-0 w-[3px]" />
                        <div className="pr-4 pl-1.5">
                          <div className="text-accent-info mb-1 text-[10px] font-bold tracking-wide">
                            {time}
                          </div>
                          <div
                            className="text-text-primary line-clamp-2 text-xs leading-snug font-semibold"
                            title={title}
                          >
                            {title}
                          </div>
                          {event.data.location && (
                            <div
                              className="text-text-tertiary mt-1.5 flex items-center gap-1 truncate text-[10px]"
                              title={event.data.location}
                            >
                              <span>📍</span>
                              <span className="truncate">
                                {event.data.location}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(event.entityId);
                          }}
                          disabled={isDeleting}
                          className="text-text-tertiary hover:text-accent-danger hover:bg-accent-danger/10 absolute top-1 right-1 cursor-pointer rounded p-1 opacity-0 transition-all duration-[var(--transition-fast)] group-hover/card:opacity-100"
                          title="Delete Event"
                        >
                          {isDeleting ? (
                            <SpinnerIcon className="h-3 w-3" />
                          ) : (
                            <TrashIcon className="h-3 w-3" />
                          )}
                        </button>
                      </a>
                    );
                  })
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1.5 opacity-40 transition-all duration-[var(--transition-base)] select-none group-hover:opacity-100">
                    <span className="text-text-tertiary text-[10px] font-medium">
                      No events
                    </span>
                    <div className="border-border-default/80 group-hover:bg-bg-surface flex h-6 w-6 items-center justify-center rounded-full border border-dashed transition-colors group-hover:border-solid">
                      <PlusIcon className="text-text-tertiary h-3.5 w-3.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  eventsByDate,
  onDateClick,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDateClick: (date: string) => void;
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
    <div className="border-border-subtle bg-bg-raised animate-fade-in flex flex-col overflow-hidden rounded-[var(--radius-lg)] border shadow-sm">
      <div className="border-border-subtle bg-bg-surface/50 grid shrink-0 grid-cols-7 border-b text-center">
        {weekdays.map((wd) => (
          <div
            key={wd}
            className="text-text-tertiary py-2 text-[10px] font-bold tracking-wider uppercase"
          >
            {wd}
          </div>
        ))}
      </div>

      <div className="divide-border-subtle grid grid-cols-7 divide-x divide-y">
        {monthCells.map((cell, idx) => {
          const key = getDayKey(cell.date);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === todayStr;
          const dateNum = cell.date.getDate();

          const sortedEvents = [...dayEvents].sort(
            (a, b) => getEventSortTime(a) - getEventSortTime(b),
          );

          return (
            <div
              key={`${key}-${idx}`}
              onClick={(e) => {
                if (
                  (e.target as HTMLElement).closest("a") ||
                  (e.target as HTMLElement).closest("button")
                ) {
                  return;
                }
                onDateClick(key);
              }}
              className={`hover:bg-bg-surface/40 hover:border-border-default flex min-h-[95px] cursor-pointer flex-col gap-1.5 border border-transparent p-2 transition-colors duration-[var(--transition-fast)] ${
                cell.isCurrentMonth
                  ? "bg-bg-raised"
                  : "bg-bg-base/20 opacity-60"
              } ${isToday ? "bg-accent-primary/5 border-accent-primary/20" : ""}`}
            >
              <div className="flex shrink-0 justify-end">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
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

              <div className="flex max-h-[60px] flex-1 scrollbar-none flex-col gap-1 overflow-y-auto">
                {sortedEvents.slice(0, 3).map((event) => {
                  const title = event.data.summary || "Untitled Event";
                  return (
                    <a
                      key={event.id}
                      href={event.data.htmlLink ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={title}
                      className="bg-bg-surface hover:bg-bg-inset border-accent-info text-text-secondary block truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[9px] leading-tight font-medium"
                    >
                      {title}
                    </a>
                  );
                })}
                {sortedEvents.length > 3 && (
                  <span className="text-text-tertiary pr-0.5 text-right text-[8px] font-bold">
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

// ─── Day View ──────────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  eventsByDate,
  onSlotClick,
  onDelete,
  deletingIds,
}: {
  currentDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSlotClick: (date: string, time: string) => void;
  onDelete: (id: string) => void;
  deletingIds: Record<string, boolean>;
}) {
  const getDayKey = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const key = getDayKey(currentDate);
  const dayEvents = eventsByDate.get(key) ?? [];

  // Generate 24 hours
  const hours = Array.from({ length: 24 }).map((_, i) => {
    const hour = i;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${displayHour} ${ampm}`;
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    return { hour, label, timeStr };
  });

  return (
    <div className="bg-bg-raised border-border-subtle animate-fade-in flex max-h-[600px] flex-col overflow-hidden rounded-[var(--radius-lg)] border shadow-sm">
      {/* Day view header */}
      <div className="border-border-subtle bg-bg-surface/30 flex shrink-0 items-center justify-between border-b p-4">
        <div>
          <h3 className="text-text-primary text-sm font-semibold">
            {currentDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h3>
          <p className="text-text-tertiary text-xs">
            {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}{" "}
            scheduled
          </p>
        </div>
      </div>

      {/* Hourly Timeline */}
      <div className="divide-border-subtle/40 flex-1 divide-y overflow-y-auto pr-1">
        {hours.map(({ hour, label, timeStr }) => {
          const hourEvents = dayEvents.filter((event) => {
            const startStr = event.data?.start?.dateTime;
            if (!startStr) return false;
            const startDate = new Date(startStr);
            return startDate.getHours() === hour;
          });

          return (
            <div
              key={hour}
              className="group hover:bg-bg-surface/20 flex min-h-[64px] transition-colors duration-[var(--transition-fast)]"
            >
              {/* Hour Label */}
              <div className="text-text-tertiary border-border-subtle/30 w-16 shrink-0 border-r px-3 py-2 text-right text-[10px] font-bold select-none">
                {label}
              </div>

              {/* Slots/Events Content area */}
              <div
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest("a") ||
                    (e.target as HTMLElement).closest("button")
                  ) {
                    return;
                  }
                  onSlotClick(key, timeStr);
                }}
                className="relative flex flex-1 cursor-pointer scrollbar-none gap-2 overflow-x-auto p-2"
              >
                {hourEvents.length > 0 ? (
                  hourEvents.map((event) => {
                    const title = event.data.summary || "Untitled Event";
                    const timeRange = formatEventTime(
                      event.data.start,
                      event.data.end,
                    );
                    const isDeleting = !!deletingIds[event.entityId];
                    return (
                      <a
                        key={event.id}
                        href={event.data.htmlLink ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group/card bg-bg-surface/50 hover:bg-bg-surface border-border-subtle/60 hover:border-border-default relative flex max-w-md min-w-[220px] flex-1 flex-col justify-between overflow-hidden rounded-[var(--radius-sm)] border p-2.5 text-left shadow-2xs transition-all duration-[var(--transition-fast)] hover:shadow-xs ${
                          isDeleting ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        {/* Left border indicator */}
                        <div className="bg-accent-info/70 group-hover/card:bg-accent-info absolute top-0 bottom-0 left-0 w-[3px]" />
                        <div className="pr-6 pl-1.5">
                          <div
                            className="text-text-primary truncate text-xs font-semibold"
                            title={title}
                          >
                            {title}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-accent-info text-[10px] font-bold tracking-wide">
                              {timeRange}
                            </span>
                            {event.data.location && (
                              <span className="text-text-tertiary flex max-w-[140px] items-center gap-0.5 truncate text-[10px]">
                                <span>📍</span>
                                <span className="truncate">
                                  {event.data.location}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(event.entityId);
                          }}
                          disabled={isDeleting}
                          className="text-text-tertiary hover:text-accent-danger hover:bg-accent-danger/10 absolute top-1 right-1 cursor-pointer rounded p-1 opacity-0 transition-all duration-[var(--transition-fast)] group-hover/card:opacity-100"
                          title="Delete Event"
                        >
                          {isDeleting ? (
                            <SpinnerIcon className="h-3.5 w-3.5" />
                          ) : (
                            <TrashIcon className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </a>
                    );
                  })
                ) : (
                  <div className="flex h-full w-full items-center justify-start pl-2 opacity-0 transition-opacity select-none group-hover:opacity-100">
                    <span className="text-accent-primary flex items-center gap-1 text-[10px] font-bold">
                      <PlusIcon className="h-3 w-3" />
                      Add event at {label}
                    </span>
                  </div>
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
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"list" | "day" | "week" | "month">("list");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedCalendars, setSelectedCalendars] = useState<
    Record<string, boolean>
  >({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const toggleCalendar = (emailAddress: string) => {
    setSelectedCalendars((prev) => ({
      ...prev,
      [emailAddress]: prev[emailAddress] === false ? true : false,
    }));
  };

  const utils = api.useUtils();
  const { data: calendarStatus, isLoading: isStatusLoading } =
    api.calendar.getConnectionStatus.useQuery();
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
      // Filter by selected calendars
      const eventEmail = event.emailAddress;
      if (eventEmail && selectedCalendars[eventEmail] === false) {
        return false;
      }

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
  }, [events, searchQuery, selectedCalendars]);

  // List view groups
  const groups = useMemo<DateGroup[]>(() => {
    const sorted = Array.from(eventsByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, evts]) => ({
        dateKey,
        heading: formatDateHeading(dateKey),
        events: evts.sort((a, b) => getEventSortTime(b) - getEventSortTime(a)),
      }));

    return sorted;
  }, [eventsByDate]);

  const totalEvents = events?.length ?? 0;

  const syncCalendar = api.calendar.syncCalendar.useMutation({
    onSuccess: () => {
      void utils.calendar.listEvents.invalidate();
    },
  });

  const deleteMutation = api.calendar.deleteEvent.useMutation({
    onMutate: (variables) => {
      setDeletingIds((prev) => ({ ...prev, [variables.id]: true }));
    },
    onSuccess: async () => {
      toast("Event deleted successfully", "success");
      await utils.calendar.listEvents.invalidate();
    },
    onError: (err) => {
      console.error("[Delete] Calendar delete failed:", err);
      toast(`Delete failed: ${err.message || err}`, "error");
    },
    onSettled: (data, error, variables) => {
      setDeletingIds((prev) => {
        const copy = { ...prev };
        delete copy[variables.id];
        return copy;
      });
    },
  });

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
    } catch (err) {
      // Handled in onError
    }
  };

  const isRefreshing = isFetching || syncCalendar.isPending;

  const handleRefresh = async () => {
    try {
      await utils.calendar.getConnectionStatus.invalidate();
      await syncCalendar.mutateAsync();
      await refetch();
      toast("Calendar synced!", "success");
    } catch (err: any) {
      console.error("[Refresh] Calendar sync failed:", err);
      toast(`Sync failed: ${err.message || err}`, "error");
    }
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() - 7);
    } else if (view === "day") {
      newDate.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() + 7);
    } else if (view === "day") {
      newDate.setDate(currentDate.getDate() + 1);
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
        <header className="animate-fade-in mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-text-secondary h-5 w-5" />
            <h1 className="text-text-primary text-xl font-semibold">
              Calendar
            </h1>
            {!isLoading && totalEvents > 0 && (
              <span className="text-text-tertiary text-sm">
                {totalEvents} event{totalEvents !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {calendarStatus?.connected && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedDate("");
                  setSelectedTime("");
                  setIsCreateOpen(true);
                }}
                className="flex cursor-pointer items-center gap-1.5 font-bold"
              >
                <PlusIcon className="h-4 w-4" />
                Create Event
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              disabled={isRefreshing || !calendarStatus?.connected}
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        {/* Date Navigation & View Switcher */}
        {!isLoading &&
          !isError &&
          calendarStatus?.connected &&
          totalEvents > 0 &&
          searchQuery.trim() === "" && (
            <div className="animate-fade-in mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {view !== "list" ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex h-8 w-8 items-center justify-center p-0 text-xs font-bold"
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
                    className="flex h-8 w-8 items-center justify-center p-0 text-xs font-bold"
                    onClick={handleNext}
                  >
                    &rarr;
                  </Button>
                  <span className="text-text-primary ml-2 text-sm font-semibold tabular-nums">
                    {view === "month"
                      ? currentDate.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : view === "day"
                        ? currentDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : (() => {
                            const start = new Date(currentDate);
                            start.setDate(
                              currentDate.getDate() - currentDate.getDay(),
                            );
                            const end = new Date(start);
                            end.setDate(start.getDate() + 6);
                            const optionsStart: Intl.DateTimeFormatOptions = {
                              month: "short",
                              day: "numeric",
                            };
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
                <div className="text-text-primary py-1 text-sm font-semibold">
                  Upcoming Schedule
                </div>
              )}

              <div className="bg-bg-raised border-border-subtle flex shrink-0 gap-1 self-start rounded-[var(--radius-md)] border p-1 shadow-sm sm:self-auto">
                <button
                  onClick={() => setView("list")}
                  className={`cursor-pointer rounded-[var(--radius-sm)] px-3 py-1 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                    view === "list"
                      ? "bg-bg-surface text-text-primary border-border-default border shadow-xs"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setView("day")}
                  className={`cursor-pointer rounded-[var(--radius-sm)] px-3 py-1 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                    view === "day"
                      ? "bg-bg-surface text-text-primary border-border-default border shadow-xs"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setView("week")}
                  className={`cursor-pointer rounded-[var(--radius-sm)] px-3 py-1 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                    view === "week"
                      ? "bg-bg-surface text-text-primary border-border-default border shadow-xs"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setView("month")}
                  className={`cursor-pointer rounded-[var(--radius-sm)] px-3 py-1 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                    view === "month"
                      ? "bg-bg-surface text-text-primary border-border-default border shadow-xs"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  Month
                </button>
              </div>
            </div>
          )}

        {/* Calendar Filter Pills */}
        {!isLoading &&
          !isError &&
          calendarStatus?.connected &&
          calendarStatus.accounts &&
          calendarStatus.accounts.length > 1 && (
            <div className="animate-fade-in mb-6 flex flex-wrap gap-2">
              {calendarStatus.accounts.map((acc: any) => {
                const isChecked = selectedCalendars[acc.emailAddress] !== false;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleCalendar(acc.emailAddress)}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                      isChecked
                        ? "bg-accent-primary/10 border-accent-primary/25 text-accent-primary animate-fade-in"
                        : "border-border-default text-text-tertiary hover:text-text-primary bg-transparent"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full transition-all ${isChecked ? "bg-accent-primary animate-pulse-subtle" : "bg-text-tertiary/40"}`}
                    />
                    {acc.emailAddress}
                  </button>
                );
              })}
            </div>
          )}

        {/* Search Input Bar */}
        {!isLoading && !isError && totalEvents > 0 && (
          <div className="animate-fade-in mb-6">
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
          <div className="animate-fade-in border-border-subtle bg-bg-raised rounded-[var(--radius-md)] border p-8 text-center">
            <div className="bg-accent-danger/10 mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <svg
                className="text-accent-danger h-5 w-5"
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
            <p className="text-text-primary mb-1 text-sm font-medium">
              Failed to load events
            </p>
            <p className="text-text-tertiary mb-4 text-xs">
              {error?.message || "Something went wrong. Please try again."}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Disconnected state */}
        {!isLoading && !isError && !calendarStatus?.connected && (
          <div className="animate-fade-in border-border-subtle bg-bg-raised rounded-[var(--radius-md)] border p-8 text-center">
            <div className="bg-bg-surface mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <CalendarIcon className="text-text-tertiary h-5 w-5" />
            </div>
            <p className="text-text-primary mb-1 text-sm font-medium">
              Calendar is not connected
            </p>
            <p className="text-text-tertiary mx-auto mb-4 max-w-sm text-xs leading-relaxed">
              Authorize Singularity to access your Google Calendar and manage
              events.
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
        {!isLoading &&
          !isError &&
          calendarStatus?.connected &&
          totalEvents === 0 && (
            <div className="animate-fade-in border-border-subtle bg-bg-raised rounded-[var(--radius-md)] border p-8 text-center">
              <div className="bg-bg-surface mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full">
                <CalendarIcon className="text-text-tertiary h-5 w-5" />
              </div>
              <p className="text-text-primary mb-1 text-sm font-medium">
                No events found
              </p>
              <p className="text-text-tertiary mb-4 text-xs leading-relaxed">
                Connected as{" "}
                {calendarStatus?.accounts?.[0]?.emailAddress || "Connected"}.
                Sync your calendar to import events.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                isLoading={isRefreshing}
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Sync Calendar
              </Button>
            </div>
          )}

        {/* Views */}
        {!isLoading && !isError && totalEvents > 0 && (
          <>
            {searchQuery.trim() !== "" ? (
              <div className="space-y-6">
                <div className="border-border-subtle/40 animate-fade-in flex items-center justify-between border-b pb-3">
                  <h2 className="text-text-primary text-sm font-semibold">
                    Search Results for "{searchQuery}"
                  </h2>
                  <span className="text-text-tertiary text-xs tabular-nums">
                    {Array.from(eventsByDate.values()).flat().length} match(es)
                    found
                  </span>
                </div>
                {groups.length > 0 ? (
                  <div className="animate-fade-in space-y-8">
                    {groups.map((group) => (
                      <DateGroupSection
                        key={group.dateKey}
                        group={group}
                        onDelete={handleDeleteEvent}
                        deletingIds={deletingIds}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="animate-fade-in border-border-subtle bg-bg-raised rounded-[var(--radius-md)] border p-8 text-center">
                    <p className="text-text-primary text-sm font-medium">
                      No results found
                    </p>
                    <p className="text-text-tertiary mt-1 text-xs">
                      No calendar events match "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {view === "list" && (
                  <div className="animate-fade-in space-y-8">
                    {groups.length > 0 ? (
                      groups.map((group) => (
                        <DateGroupSection
                          key={group.dateKey}
                          group={group}
                          onDelete={handleDeleteEvent}
                          deletingIds={deletingIds}
                        />
                      ))
                    ) : (
                      <div className="border-border-subtle bg-bg-raised rounded-[var(--radius-md)] border p-8 text-center">
                        <p className="text-text-primary text-sm font-medium">
                          No events scheduled
                        </p>
                        <p className="text-text-tertiary mt-1 text-xs">
                          You have no events in your calendar.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {view === "day" && (
                  <DayView
                    currentDate={currentDate}
                    eventsByDate={eventsByDate}
                    onSlotClick={(date, time) => {
                      setSelectedDate(date);
                      setSelectedTime(time);
                      setIsCreateOpen(true);
                    }}
                    onDelete={handleDeleteEvent}
                    deletingIds={deletingIds}
                  />
                )}

                {view === "week" && (
                  <WeekView
                    currentDate={currentDate}
                    eventsByDate={eventsByDate}
                    onDateClick={(date) => {
                      setSelectedDate(date);
                      setSelectedTime("");
                      setIsCreateOpen(true);
                    }}
                    onDelete={handleDeleteEvent}
                    deletingIds={deletingIds}
                  />
                )}

                {view === "month" && (
                  <MonthView
                    currentDate={currentDate}
                    eventsByDate={eventsByDate}
                    onDateClick={(date) => {
                      setSelectedDate(date);
                      setSelectedTime("");
                      setIsCreateOpen(true);
                    }}
                  />
                )}
              </>
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
        defaultDate={selectedDate}
        defaultTime={selectedTime}
      />
    </div>
  );
}

function CreateEventModal({
  isOpen,
  onClose,
  onEventCreated,
  defaultDate,
  defaultTime,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
  defaultDate?: string;
  defaultTime?: string;
}) {
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const { data: calendarStatus } = api.calendar.getConnectionStatus.useQuery();

  // Form Fields
  const [summary, setSummary] = useState("");
  const [fromEmail, setFromEmail] = useState("");
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

  useEffect(() => {
    if (isOpen) {
      if (defaultDate) {
        setStartDate(defaultDate);
        setEndDate(defaultDate);
      } else {
        const d = new Date();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        setStartDate(dateStr);
        setEndDate(dateStr);
      }

      if (defaultTime) {
        setStartTime(defaultTime);
        const [h, m] = defaultTime.split(":").map(Number);
        const nextH = (h! + 1) % 24;
        const endTimeStr = `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        setEndTime(endTimeStr);
      } else {
        setStartTime("10:00");
        setEndTime("11:00");
      }

      const firstAccount = calendarStatus?.accounts?.[0];
      if (firstAccount) {
        setFromEmail(firstAccount.emailAddress);
      } else {
        setFromEmail("");
      }
    }
  }, [isOpen, defaultDate, defaultTime, calendarStatus]);
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
        setErrorMsg(
          "Failed to parse AI response. Please try describing it differently or use the manual form.",
        );
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
    setFromEmail("");
  };

  const handleSave = () => {
    if (!summary) {
      setErrorMsg("Summary is required.");
      return;
    }
    setErrorMsg("");

    const startISO = toLocalOffsetDateTime(startDate, startTime);
    const endISO = toLocalOffsetDateTime(endDate, endTime);

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
      fromEmail: fromEmail || undefined,
    });
  };

  const handleAiDraft = () => {
    if (!aiText.trim()) return;
    setErrorMsg("");
    setIsAiLoading(true);

    const now = new Date();
    const prompt = `Translate this natural language event request into a structured JSON object.
Request: "${aiText}"
Current local time reference: ${now.toISOString()} (Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })})

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
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-bg-raised border-border-default animate-slide-up flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border-subtle flex items-center justify-between border-b p-4">
          <h2 className="text-text-primary text-sm font-semibold">
            Create Event
          </h2>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-text-tertiary hover:text-text-primary cursor-pointer p-1 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="border-border-subtle bg-bg-raised/10 shrink-0 border-b p-4 pb-2">
          <div className="bg-bg-inset border-border-subtle flex w-full gap-1 rounded-xl border p-1 shadow-inner">
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                activeTab === "manual"
                  ? "bg-bg-surface text-text-primary border-border-default border shadow-xs"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Manual Form
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-semibold transition-all duration-[var(--transition-fast)] ${
                activeTab === "ai"
                  ? "bg-bg-surface text-text-primary border-border-default border shadow-xs"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Draft with AI
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {errorMsg && (
            <div className="animate-fade-in rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs leading-relaxed font-semibold text-red-400">
              {errorMsg}
            </div>
          )}

          {activeTab === "ai" ? (
            <div className="animate-fade-in flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                  Describe Event
                </label>
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="e.g. Lunch with Sarah tomorrow at 1:00 PM to 2:00 PM at Olive Garden..."
                  rows={4}
                  className="border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary w-full resize-none rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed font-medium transition-all outline-none"
                />
              </div>
              <Button
                onClick={handleAiDraft}
                isLoading={isAiLoading}
                disabled={isAiLoading || !aiText.trim()}
                className="h-10 w-full cursor-pointer text-xs font-bold tracking-wider uppercase"
              >
                Generate Event Details
              </Button>
            </div>
          ) : (
            <div className="animate-fade-in flex flex-col gap-3.5">
              {/* Summary */}
              <div className="flex flex-col gap-1.5">
                <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                  Title
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Event title"
                  className="border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary w-full rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors outline-none"
                />
              </div>

              {/* Calendar Account Selector (Only if multiple connected) */}
              {calendarStatus?.accounts &&
                calendarStatus.accounts.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                      Calendar Account
                    </label>
                    <select
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary w-full rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors outline-none"
                    >
                      {calendarStatus.accounts.map((acc: any) => (
                        <option key={acc.id} value={acc.emailAddress}>
                          {acc.emailAddress}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary w-full rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary w-full rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary w-full rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border-border-subtle bg-bg-inset text-text-primary focus:border-accent-primary w-full rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1.5">
                <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Zoom, Office, Cafe..."
                  className="border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary w-full rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors outline-none"
                />
              </div>

              {/* Attendees */}
              <div className="flex flex-col gap-1.5">
                <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                  Attendees (Optional)
                </label>
                <input
                  type="text"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="e.g. sarah@example.com, bob@example.com"
                  className="border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary w-full rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors outline-none"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-text-tertiary text-[10px] font-bold tracking-wider uppercase">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event description..."
                  rows={3}
                  className="border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary w-full resize-none rounded-xl border px-3.5 py-2 text-xs leading-relaxed font-medium transition-colors outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-border-subtle bg-bg-raised/10 flex shrink-0 items-center gap-2 border-t p-4">
          <Button
            variant="secondary"
            className="h-9 flex-1 cursor-pointer text-xs font-bold"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          {activeTab === "manual" && (
            <Button
              className="h-9 flex-1 cursor-pointer text-xs font-bold tracking-wider uppercase"
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
