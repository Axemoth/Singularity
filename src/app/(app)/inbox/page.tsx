"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/app/_components/ui/button";
import { Badge } from "@/app/_components/ui/badge";
import { useToast } from "@/app/_components/ui/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GmailMessage {
  id: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
}

interface GmailThreadData {
  id: string;
  snippet?: string;
  messages?: GmailMessage[];
}

interface ThreadEntity {
  id: string;
  entityId: string;
  data: unknown;
  updatedAt: Date;
  priority: string | null;
  priorityReason: string | null;
  emailAddress?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getThreadData(thread: ThreadEntity): GmailThreadData {
  return (thread.data ?? {}) as GmailThreadData;
}

function getMessageHeader(msg: any, name: string): string | undefined {
  if (!msg) return undefined;
  if (msg[name.toLowerCase()]) return msg[name.toLowerCase()];
  const headers = msg.payload?.headers ?? [];
  return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;
}

function formatRelativeTime(epochMs: string | undefined): string {
  if (!epochMs) return "";
  const date = new Date(Number(epochMs));
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseSenderName(from: string | undefined): string {
  if (!from) return "Unknown";
  const match = from.match(/^(.+?)\s*</);
  return match?.[1]?.trim()?.replace(/"/g, "") || from.split("@")[0] || "Unknown";
}

function formatFullDate(epochMs: string | undefined): string {
  if (!epochMs) return "";
  const date = new Date(Number(epochMs));
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

// ---------------------------------------------------------------------------
// Sender Avatar
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function SenderAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const color = getAvatarColor(name);
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs';
  return (
    <span
      className={`${dim} shrink-0 rounded-full flex items-center justify-center font-bold text-white select-none`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function ThreadListSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-[var(--radius-md)] p-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-bg-surface animate-pulse-subtle" />
            <div className="h-3 w-10 rounded bg-bg-surface animate-pulse-subtle" />
          </div>
          <div className="h-3.5 w-48 rounded bg-bg-surface animate-pulse-subtle" />
          <div className="h-3 w-full rounded bg-bg-surface animate-pulse-subtle" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-7 w-72 rounded bg-bg-surface animate-pulse-subtle" />
      <div className="flex items-center gap-3">
        <div className="h-4 w-40 rounded bg-bg-surface animate-pulse-subtle" />
        <div className="h-4 w-32 rounded bg-bg-surface animate-pulse-subtle" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full rounded bg-bg-surface animate-pulse-subtle"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread List Item
// ---------------------------------------------------------------------------

function ThreadListItem({
  thread,
  isSelected,
  onSelect,
  onArchive,
  onDelete,
}: {
  thread: ThreadEntity;
  isSelected: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const threadData = getThreadData(thread);
  const firstMessage = threadData.messages?.[0];
  const isUnread = firstMessage?.labelIds?.includes("UNREAD") ?? false;
  
  const fromHeader = getMessageHeader(firstMessage, "from");
  const subjectHeader = getMessageHeader(firstMessage, "subject");
  
  const sender = fromHeader ? parseSenderName(fromHeader) : "Notification";
  const subject = subjectHeader || truncate(threadData.snippet, 40) || "No Subject";
  const snippet = truncate(threadData.snippet, 80);
  
  const messages = threadData.messages ?? [];
  const latestMessage = messages[messages.length - 1];
  const time = formatRelativeTime(latestMessage?.internalDate || thread.updatedAt.getTime().toString());
  const priority = thread.priority as "urgent" | "normal" | "low" | null;

  return (
    <div
      className={`relative w-full text-left rounded-[var(--radius-md)] transition-all duration-[var(--transition-fast)] cursor-pointer group ${
        isSelected
          ? "bg-bg-surface border border-border-default shadow-sm"
          : "border border-transparent hover:bg-bg-surface/60"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5"
      >
        <div className="flex items-start gap-2.5">
          {/* Sender Avatar */}
          <SenderAvatar name={sender} size="md" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Unread dot */}
                {isUnread && !isSelected && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-accent-primary" />
                )}
                {/* Priority dot */}
                {!isUnread && priority === "urgent" && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-accent-danger" />
                )}
                {!isUnread && priority === "normal" && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-accent-warning" />
                )}
                <span
                  className={`truncate text-sm ${
                    isUnread
                      ? "font-semibold text-text-primary"
                      : "font-medium text-text-secondary"
                  }`}
                >
                  {sender}
                </span>
                {thread.emailAddress && (
                  <span 
                    className="text-[9px] px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded-md font-medium truncate max-w-[90px] shrink-0"
                    title={thread.emailAddress}
                  >
                    {thread.emailAddress.split('@')[0]}
                  </span>
                )}
              </div>
              {/* Time - hide on hover to show action buttons */}
              {!isHovered && (
                <span className="shrink-0 text-[11px] text-text-tertiary tabular-nums">
                  {time}
                </span>
              )}
              {/* Hover action buttons */}
              {isHovered && (onArchive || onDelete) && (
                <div className="flex items-center gap-0.5 shrink-0 animate-fade-in">
                  {onArchive && (
                    <button
                      type="button"
                      title="Archive"
                      onClick={(e) => { e.stopPropagation(); onArchive(); }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-inset transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="21 8 21 21 3 21 3 8" />
                        <rect x="1" y="3" width="22" height="5" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
            <p
              className={`truncate text-[12.5px] leading-snug ${
                isUnread ? "font-semibold text-text-primary" : "text-text-secondary"
              }`}
            >
              {subject}
            </p>
            <p className="truncate text-xs text-text-tertiary mt-0.5 leading-relaxed">
              {snippet}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Reply Form Component
// ---------------------------------------------------------------------------

function parseSenderEmail(from: string | undefined): string {
  if (!from) return "";
  const match = from.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return from.trim();
}

function InlineReplyForm({
  thread,
  latestMessage,
  onReplySent,
}: {
  thread: ThreadEntity;
  latestMessage: any;
  onReplySent: () => void;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for global R key shortcut to open reply
  useEffect(() => {
    const handler = () => {
      setIsReplying(true);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    window.addEventListener('open-reply', handler);
    return () => window.removeEventListener('open-reply', handler);
  }, []);

  const utils = api.useUtils();
  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      setReplyBody("");
      setAiPrompt("");
      setIsReplying(false);
      toast("Reply sent successfully!", "success");
      void utils.gmail.listThreads.invalidate();
      void utils.gmail.getThread.invalidate({ id: thread.entityId });
      onReplySent();
    },
    onError: (err) => {
      toast(`Failed to send: ${err.message}`, "error");
    },
  });

  const chat = api.agent.chat.useMutation({
    onSuccess: (data) => {
      let cleanText = data.text;
      const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
      cleanText = cleanText.replace(thinkRegex, "").trim();
      cleanText = cleanText.replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "");
      setReplyBody(cleanText);
    },
    onError: (err) => {
      toast(`AI drafting error: ${err.message}`, 'error');
    },
  });

  if (!latestMessage) return null;

  const originalFrom = getMessageHeader(latestMessage, "from") ?? "";
  const originalSubject = getMessageHeader(latestMessage, "subject") ?? "No Subject";
  const parentMessageId = getMessageHeader(latestMessage, "message-id") ?? "";

  const replyToEmail = parseSenderEmail(originalFrom);
  const replyToName = parseSenderName(originalFrom);

  const handleSend = () => {
    if (!replyBody.trim()) return;

    const subject = originalSubject.toLowerCase().startsWith("re:")
      ? originalSubject
      : `Re: ${originalSubject}`;

    sendEmail.mutate({
      to: replyToEmail,
      subject,
      body: replyBody.replace(/\n/g, "<br>"),
      threadId: thread.entityId,
      parentMessageId,
    });
  };

  const handleAiDraft = () => {
    if (!aiPrompt.trim()) return;

    const originalBody = latestMessage.body ?? latestMessage.snippet ?? "";
    const contextPrompt = `You are a helpful email assistant. Your task is to draft a reply to the email below.
Original Email Details:
From: ${originalFrom}
Subject: ${originalSubject}
Body/Snippet: ${originalBody}

User Reply Instructions:
"${aiPrompt}"

Please output ONLY the email reply body text. Do not output subject, signature, greeting header, or conversational filler. Output the raw reply body draft directly.`;

    chat.mutate({
      message: contextPrompt,
      history: [],
      context: {
        route: "/inbox",
      },
    });
  };

  return (
    <div className="mt-4 border border-border-default bg-bg-surface rounded-xl p-5 shadow-sm text-left">

      {!isReplying ? (
        <div 
          onClick={() => setIsReplying(true)}
          className="border border-border-subtle bg-bg-inset hover:border-border-default text-text-tertiary cursor-pointer px-4 py-3 rounded-[var(--radius-md)] text-xs flex items-center justify-between transition-colors"
        >
          <span>Click to reply to {replyToName || replyToEmail}... <kbd className="ml-1.5 px-1 bg-bg-surface border border-border-default rounded text-[9px] font-mono font-semibold text-text-secondary">R</kbd></span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary">Quick Reply</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="flex flex-col gap-1 text-xs border-b border-border-subtle pb-3">
            <div>
              <span className="text-text-tertiary font-medium">To: </span>
              <span className="font-semibold text-text-primary">{replyToName} &lt;{replyToEmail}&gt;</span>
            </div>
            <div>
              <span className="text-text-tertiary font-medium">Subject: </span>
              <span className="text-text-secondary font-medium">
                {originalSubject.toLowerCase().startsWith("re:") ? originalSubject : `Re: ${originalSubject}`}
              </span>
            </div>
          </div>

          <div className="flex gap-2 items-center bg-bg-raised/35 border border-border-subtle rounded-xl p-2.5">
            <div className="bg-accent-primary/10 text-accent-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-lg">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.25 8.25 18 9.25l-.25-1a2 2 0 0 0-1.25-1.25l-1-.25 1-.25a2 2 0 0 0 1.25-1.25l.25-1 .25 1a2 2 0 0 0 1.25 1.25l1 .25-1 .25a2 2 0 0 0-1.25 1.25ZM17.5 20l-.5 1.75L16.5 20a2.5 2.5 0 0 0-1.75-1.75L13 17.75l1.75-.5A2.5 2.5 0 0 0 16.5 15.5l.5-1.75.5 1.75a2.5 2.5 0 0 0 1.75 1.75l1.75.5-1.75.5A2.5 2.5 0 0 0 17.5 20Z" />
              </svg>
            </div>
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Tell AI Co-Pilot what to say (e.g., 'agree to meet next Friday at 10 AM')..."
              className="flex-1 bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-tertiary"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAiDraft();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="py-1 px-3 h-8 text-[11px] font-semibold border-accent-primary/20 hover:border-accent-primary/45 cursor-pointer"
              onClick={handleAiDraft}
              isLoading={chat.isPending}
            >
              Draft with AI
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write your email reply here..."
              rows={5}
              className="w-full resize-none border border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3.5 py-3 text-xs rounded-[var(--radius-md)] transition-colors focus:bg-bg-base/20 leading-relaxed font-medium"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-3 mt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReplyBody("");
                setAiPrompt("");
                setIsReplying(false);
              }}
              className="py-1 px-3 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              isLoading={sendEmail.isPending}
              className="py-1 px-4 text-xs font-bold uppercase tracking-wider h-8 cursor-pointer"
            >
              Send Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Summary Strip
// ---------------------------------------------------------------------------

function cleanSummaryText(text: string): string {
  // 1. Remove <think> blocks
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Extract starting from the actual summary header if present
  // Matches "**Summary:**", "Summary:", "**Summary**", etc.
  const summaryHeaderRegex = /(?:\*\*\s*)?summary\s*(?:\*\*)?\s*:\s*/i;
  const headerMatch = clean.match(summaryHeaderRegex);
  if (headerMatch && headerMatch.index !== undefined) {
    clean = clean.substring(headerMatch.index);
  } else {
    // If no explicit header, strip typical conversational preambles
    // E.g. "Let me search locally..." or "Based on the email content..."
    const preambleRegex = /^(?:let me|i'll|i will|i am|based on|according to|looking at|searching|here['']s what|allow me|this is).*/i;
    const lines = clean.split('\n');
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      if (preambleRegex.test(line)) {
        startIdx = i + 1;
      } else {
        break;
      }
    }
    clean = lines.slice(startIdx).join('\n').trim();
  }

  // 3. Remove conversational postamble (questions, offers of action) at the end of the text
  // We search for matches to typical ending phrases and strip from the first one that is at the end of the text.
  const postambleRegex = /\b(?:would you like me to|would you like|should i|do you want me to|do you want|let me know if|is there anything|feel free|can i help|what action|how would you)\b/gi;
  const matches = [...clean.matchAll(postambleRegex)];
  for (const match of matches) {
    if (match && match.index !== undefined) {
      const remainingText = clean.substring(match.index);
      const hasBulletPoints = /^[ \t]*[-*+]\s/m.test(remainingText) || /^[ \t]*\d+\.\s/m.test(remainingText);
      const hasHeaders = /\baction items\b/i.test(remainingText) || /^(?:\s+)?#+/m.test(remainingText);
      
      if (!hasBulletPoints && !hasHeaders) {
        clean = clean.substring(0, match.index).trim();
        break;
      }
    }
  }

  return clean || text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function ThreadSummaryBar({ thread, messages }: { thread: ThreadEntity; messages: GmailMessage[] }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const chat = api.agent.chat.useMutation({
    onSuccess: (data) => {
      const cleaned = cleanSummaryText(data.text);
      setSummary(cleaned);
      setIsLoading(false);
    },
    onError: (err) => {
      toast(`AI summary failed: ${err.message}`, 'error');
      setIsLoading(false);
    },
  });

  const handleSummarize = () => {
    if (messages.length === 0) return;
    setIsLoading(true);
    const emailContext = messages
      .slice(-5)
      .map((m) => {
        const from = getMessageHeader(m, 'from') ?? 'Unknown';
        const body = m.body ?? m.snippet ?? '';
        return `From: ${from}\n${body.slice(0, 600)}`;
      })
      .join('\n---\n');

    chat.mutate({
      message: `Summarize this email thread in 2-3 sentences and list any action items. Be concise. Output ONLY the summary and action items. Do not include any conversational preamble or postamble.\n\nThread:\n${emailContext}`,
      history: [],
      context: { route: '/inbox' },
    });
  };

  if (summary) {
    return (
      <div className="mx-6 mt-3 mb-1 rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-4 py-3 animate-fade-in">
        <div className="flex items-start gap-2.5">
          <svg className="h-4 w-4 mt-0.5 shrink-0 text-accent-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091Z" />
          </svg>
          <p className="text-xs text-text-secondary leading-relaxed flex-1">{summary}</p>
          <button onClick={() => setSummary(null)} className="text-text-tertiary hover:text-text-secondary shrink-0 cursor-pointer" title="Dismiss">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-6 mt-3 mb-1">
      <button
        onClick={handleSummarize}
        disabled={isLoading || messages.length === 0}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-primary/70 hover:text-accent-primary transition-colors cursor-pointer disabled:opacity-50"
      >
        <svg className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091Z" />
        </svg>
        {isLoading ? 'Summarizing...' : 'AI Summary'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Priority Selector Dropdown
// ---------------------------------------------------------------------------

function PrioritySelector({
  threadId,
  currentPriority,
}: {
  threadId: string;
  currentPriority: "urgent" | "normal" | "low";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useUtils();
  const toast = useToast();

  const mutation = api.gmail.setThreadPriority.useMutation({
    onSuccess: (_, variables) => {
      toast(`Priority manually set to ${variables.priority}. The AI will learn from this correction.`, "success");
      void utils.gmail.listThreads.invalidate();
      void utils.gmail.getLearningStats.invalidate();
    },
    onError: (err) => {
      toast(`Error updating priority: ${err.message}`, "error");
    },
  });

  const handleSelect = (newPriority: "urgent" | "normal" | "low") => {
    setIsOpen(false);
    if (newPriority === currentPriority) return;
    
    toast(`Saving manual override: ${newPriority}`, "info");

    mutation.mutate({
      threadId,
      priority: newPriority,
      reason: "Manually adjusted by user",
    });
  };

  const priorityMeta = {
    urgent: { label: "Urgent", color: "bg-accent-danger/15 text-accent-danger border-accent-danger/30" },
    normal: { label: "Normal", color: "bg-accent-info/15 text-accent-info border-accent-info/30" },
    low: { label: "Low", color: "bg-bg-surface border-border-subtle text-text-tertiary" },
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={mutation.isPending}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 ${priorityMeta[currentPriority].color}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          currentPriority === "urgent" ? "bg-accent-danger" : currentPriority === "normal" ? "bg-accent-info" : "bg-text-tertiary"
        }`} />
        {currentPriority}
        <svg className="h-3 w-3 opacity-60 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-32 origin-top-left rounded-lg border border-border-default bg-bg-raised shadow-[var(--shadow-lg)] z-20 py-1 animate-scale-in">
            {(["urgent", "normal", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handleSelect(p)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold hover:bg-bg-surface transition-colors cursor-pointer ${
                  p === currentPriority ? "text-text-primary bg-bg-surface/50" : "text-text-secondary"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${
                  p === "urgent" ? "bg-accent-danger" : p === "normal" ? "bg-accent-info" : "bg-text-tertiary"
                }`} />
                {priorityMeta[p].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread Detail
// ---------------------------------------------------------------------------

function ThreadDetail({
  thread,
  onArchive,
  onDelete,
  isArchiving,
  isDeleting,
}: {
  thread: ThreadEntity;
  onArchive: () => void;
  onDelete: () => void;
  isArchiving: boolean;
  isDeleting: boolean;
}) {
  const {
    data: fullThread,
    isLoading,
    error,
  } = api.gmail.getThread.useQuery(
    { id: thread.entityId },
    { enabled: !!thread.entityId }
  );

  const threadData = getThreadData(thread);
  const firstMessage = threadData.messages?.[0];
  const subject = getMessageHeader(firstMessage, "subject") ?? "No Subject";

  // Combine messages from full thread response or fall back to cached data
  const fullThreadData = (fullThread ?? {}) as GmailThreadData;
  const messages: GmailMessage[] =
    fullThreadData.messages ?? threadData.messages ?? [];

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        <h2 className="text-base font-semibold text-text-primary truncate pr-4">
          {subject}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {thread.priority ? (
            <PrioritySelector threadId={thread.entityId} currentPriority={thread.priority as "urgent" | "normal" | "low"} />
          ) : (
            <Badge>Unprioritized</Badge>
          )}
          {thread.priorityReason && (
            <span className="text-xs text-text-tertiary italic max-w-[200px] truncate" title={thread.priorityReason}>
              "{thread.priorityReason}"
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onArchive}
            isLoading={isArchiving}
            disabled={isArchiving || isDeleting}
          >
            <ArchiveIcon />
            Archive
            <kbd className="ml-1.5 px-1 bg-bg-raised border border-border-default rounded text-[9px] font-mono font-semibold text-text-tertiary">E</kbd>
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            isLoading={isDeleting}
            disabled={isArchiving || isDeleting}
          >
            <TrashIcon />
            Delete
            <kbd className="ml-1.5 px-1 bg-bg-raised border border-border-default rounded text-[9px] font-mono font-semibold text-text-tertiary">#</kbd>
          </Button>
        </div>
      </div>

      {/* AI Summary Strip */}
      {!isLoading && !error && messages.length > 0 && (
        <ThreadSummaryBar thread={thread} messages={messages} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <DetailSkeleton />
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-accent-danger">
              Failed to load thread. Please try again.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-text-tertiary">No messages found.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle pb-8">
            {messages.map((msg, idx) => (
              <MessageCard key={msg.id ?? idx} message={msg} />
            ))}
            <div className="px-6 py-4 border-t border-border-subtle bg-bg-raised/10">
              <InlineReplyForm 
                thread={thread} 
                latestMessage={messages[messages.length - 1]} 
                onReplySent={() => {
                  // list invalidations are handled in mutation onSuccess
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Card
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Message Card
// ---------------------------------------------------------------------------

function SafeEmailRenderer({ htmlContent }: { htmlContent: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState("150px");

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleResize = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          // Set standard styles matching the parent dark/light modes
          const isDark = document.documentElement.classList.contains("dark");
          
          // Apply theme class to iframe's root
          if (isDark) {
            doc.documentElement.classList.add("dark");
          } else {
            doc.documentElement.classList.remove("dark");
          }

          if (!doc.getElementById("email-custom-styles")) {
            const style = doc.createElement("style");
            style.id = "email-custom-styles";
            style.textContent = `
              :root {
                --text-primary: #1a1a2e;
                --text-secondary: #495057;
                --text-tertiary: #868e96;
                --border-default: #dee2e6;
                --bg-surface: #f1f3f5;
                --accent-info: #3b82f6;
              }
              .dark {
                --text-primary: #e8e8ed;
                --text-secondary: #9898a6;
                --text-tertiary: #5c5c6e;
                --border-default: #2a2a38;
                --bg-surface: #252530;
                --accent-info: #60a5fa;
              }
              body {
                margin: 0;
                font-family: ui-sans-serif, system-ui, sans-serif;
                color: var(--text-secondary);
                font-size: 0.875rem;
                line-height: 1.6;
                background-color: transparent;
                word-break: break-word;
              }
              a {
                color: var(--accent-info);
                text-decoration: underline;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              table {
                width: 100% !important;
                border-collapse: collapse;
              }
              blockquote {
                border-left: 2px solid var(--border-default);
                padding-left: 0.75rem;
                margin-left: 0;
                margin-right: 0;
                color: var(--text-tertiary);
              }
              pre {
                background-color: var(--bg-surface);
                padding: 0.75rem;
                border-radius: 6px;
                overflow-x: auto;
              }
            `;
            doc.head.appendChild(style);
          }

          // Force all links to open in a new tab/window for safety and UX
          const links = doc.querySelectorAll("a");
          links.forEach((link) => {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
          });

          // Adjust height
          const newHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight;
          setHeight(`${newHeight + 24}px`);
        }
      } catch (e) {
        console.error("Error adjusting email iframe height:", e);
      }
    };

    iframe.addEventListener("load", handleResize);

    // Initial trigger after short delay to let browser lay out the iframe
    const initialTimer = setTimeout(handleResize, 50);

    // Watch for internal mutations/resizes (e.g. image loads)
    let observer: ResizeObserver | null = null;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.body && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
          handleResize();
        });
        observer.observe(doc.body);
      }
    } catch (e) {
      console.error("Error initializing ResizeObserver on email iframe:", e);
    }

    return () => {
      iframe.removeEventListener("load", handleResize);
      clearTimeout(initialTimer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [htmlContent]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={htmlContent}
      sandbox="allow-same-origin allow-popups"
      style={{
        width: "100%",
        height: height,
        border: "none",
        overflow: "hidden",
        backgroundColor: "transparent",
      }}
    />
  );
}

function MessageCard({ message }: { message: GmailMessage }) {
  const fromHeader = getMessageHeader(message, "from");
  const toHeader = getMessageHeader(message, "to");
  const sender = parseSenderName(fromHeader);
  const date = formatFullDate(message.internalDate);
  
  let htmlContent = message.body;
  if (!htmlContent && (message as any).payload) {
    const payload = (message as any).payload;
    if (payload.body?.data) {
      htmlContent = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload.parts) {
      const findBody = (parts: any[]): string => {
        const htmlPart = parts.find((p: any) => p.mimeType === "text/html");
        if (htmlPart?.body?.data) {
          return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
        }
        const textPart = parts.find((p: any) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          return Buffer.from(textPart.body.data, "base64").toString("utf-8");
        }
        for (const part of parts) {
          if (part.parts) {
            const nested = findBody(part.parts);
            if (nested) return nested;
          }
        }
        return "";
      };
      htmlContent = findBody(payload.parts);
    }
  }
  if (!htmlContent) {
    htmlContent = message.snippet || "";
  }

  return (
    <div className="px-6 py-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{sender}</p>
          {message.to && (
            <p className="text-xs text-text-tertiary mt-0.5 truncate">
              To: {message.to}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
          {date}
        </span>
      </div>
      <div className="prose-email text-sm text-text-secondary leading-relaxed max-w-none">
        <SafeEmailRenderer htmlContent={htmlContent} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs)
// ---------------------------------------------------------------------------

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-tertiary"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function InboxPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "priority" | "other" | "sent" | "drafts">("all");
  const [priorityInput, setPriorityInput] = useState("");
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [selectedEmailFilter, setSelectedEmailFilter] = useState<string>("all");
  const toast = useToast();

  const utils = api.useUtils();

  const { data: dbPriorityRules } = api.gmail.getPriorityRules.useQuery();

  // Populate local rules when database rules load
  useEffect(() => {
    if (dbPriorityRules !== undefined) {
      setPriorityInput(dbPriorityRules);
    }
  }, [dbPriorityRules]);

  // Read ?tab parameter on load/mount/update
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "sent" || tab === "drafts" || tab === "all" || tab === "priority" || tab === "other") {
        setActiveTab(tab);
      }
    }
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  const setRulesMutation = api.gmail.setPriorityRules.useMutation({
    onSuccess: () => {
      void utils.gmail.listThreads.invalidate();
      setIsEditingRules(false);
    },
  });

  const { data: gmailStatus, isLoading: isStatusLoading } = api.gmail.getConnectionStatus.useQuery();

  const {
    data: threads,
    isLoading: isThreadsLoading,
    error,
    refetch,
  } = api.gmail.listThreads.useQuery({ refresh: false });

  const isLoading = isThreadsLoading || isStatusLoading;

  const archiveMutation = api.gmail.archiveThread.useMutation({
    onSuccess: () => {
      toast("Thread archived", "success");
      setSelectedThreadId(null);
      void utils.gmail.listThreads.invalidate();
    },
    onError: (err) => {
      toast(`Archive failed: ${err.message}`, "error");
    },
  });

  const deleteMutation = api.gmail.deleteThread.useMutation({
    onSuccess: () => {
      toast("Thread deleted", "success");
      setSelectedThreadId(null);
      void utils.gmail.listThreads.invalidate();
    },
    onError: (err) => {
      toast(`Delete failed: ${err.message}`, "error");
    },
  });

  const selectedThread =
    threads?.find((t) => t.id === selectedThreadId) ?? null;

  const syncInbox = api.gmail.syncInbox.useMutation({
    onSuccess: () => {
      toast("Inbox synced!", "success");
      void utils.gmail.listThreads.invalidate();
    },
    onError: (err) => {
      toast(`Sync failed: ${err.message}`, "error");
    },
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Invalidate the status query as well to ensure we have the latest info
      await utils.gmail.getConnectionStatus.invalidate();
      await syncInbox.mutateAsync();
    } catch (err) {
      console.error("[Refresh] Live sync failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [utils.gmail.getConnectionStatus, syncInbox]);

  const handleArchive = useCallback(() => {
    if (!selectedThread) return;
    archiveMutation.mutate({ id: selectedThread.entityId });
  }, [selectedThread, archiveMutation]);

  const handleDelete = useCallback(() => {
    if (!selectedThread) return;
    deleteMutation.mutate({ id: selectedThread.entityId });
  }, [selectedThread, deleteMutation]);

  // Keyboard shortcuts: E = archive, # = delete, R = open reply
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!selectedThread) return;

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleArchive();
      } else if (e.key === '#') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        // Dispatch event to open reply in the thread detail
        window.dispatchEvent(new CustomEvent('open-reply'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedThread, handleArchive, handleDelete]);

  const threadCount = threads?.length ?? 0;

  // Helper to get actual latest message timestamp in the thread
  const getThreadTimestamp = (t: ThreadEntity) => {
    const threadData = getThreadData(t);
    const messages = threadData.messages ?? [];
    if (messages.length > 0) {
      const dates = messages
        .map((m) => (m.internalDate ? parseInt(m.internalDate, 10) : 0))
        .filter((d) => !isNaN(d) && d > 0);
      if (dates.length > 0) {
        return Math.max(...dates);
      }
    }
    return t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
  };

  // Sort threads: unread first, then by priority weight, then by date/time (most recent first)
  const getPriorityWeight = (priority: string | null) => {
    if (priority === "urgent") return 3;
    if (priority === "normal") return 2;
    return 1; // low or null
  };

  // Filter threads by selected account first
  const filteredByEmailThreads = threads
    ? threads.filter((t: any) => {
        if (selectedEmailFilter === "all") return true;
        return t.emailAddress?.toLowerCase() === selectedEmailFilter.toLowerCase();
      })
    : [];

  const sortedAllThreads = filteredByEmailThreads.length > 0
    ? [...filteredByEmailThreads].sort((a, b) => {
        const aUnread = getThreadData(a).messages?.[0]?.labelIds?.includes("UNREAD") ?? false;
        const bUnread = getThreadData(b).messages?.[0]?.labelIds?.includes("UNREAD") ?? false;

        // 1. Unread status first
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;

        // 2. Priority weight second
        const aWeight = getPriorityWeight(a.priority);
        const bWeight = getPriorityWeight(b.priority);
        if (aWeight !== bWeight) {
          return bWeight - aWeight;
        }

        // 3. Date third (most recent first)
        const aTime = getThreadTimestamp(a);
        const bTime = getThreadTimestamp(b);
        return bTime - aTime;
      })
    : [];

  // Filter threads for All, Priority, Other, Sent, and Drafts tabs
  const priorityThreads = sortedAllThreads.filter(t => t.priority === "urgent" || t.priority === "normal");
  const otherThreads = sortedAllThreads.filter(t => t.priority !== "urgent" && t.priority !== "normal");
  
  const sentThreads = sortedAllThreads.filter(t => {
    const threadData = getThreadData(t);
    return threadData.messages?.some(m => m.labelIds?.includes("SENT"));
  });

  const draftThreads = sortedAllThreads.filter(t => {
    const threadData = getThreadData(t);
    return threadData.messages?.some(m => m.labelIds?.includes("DRAFT"));
  });

  const visibleThreads = 
    activeTab === "all" 
      ? sortedAllThreads 
      : activeTab === "priority" 
      ? priorityThreads 
      : activeTab === "other"
      ? otherThreads
      : activeTab === "sent"
      ? sentThreads
      : draftThreads;

  return (
    <div className="flex h-full animate-fade-in">
      {/* ---- Left Panel: Thread List ---- */}
      <div className="w-[520px] shrink-0 flex flex-col border-r border-border-default bg-bg-raised">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-text-primary">Inbox</h1>
            {!isLoading && threads && threads.length > 0 && (
              <Badge>{threadCount}</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || !gmailStatus?.connected}
            className="p-1.5 rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-[var(--transition-fast)] disabled:opacity-50 cursor-pointer"
            title="Refresh inbox"
          >
            <RefreshIcon
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>

        {/* Tabs */}
        {gmailStatus?.connected && threads && threads.length > 0 && (
          <div className="flex border-b border-border-subtle px-3 py-1 bg-bg-raised/30 gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-md)] cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                activeTab === "all"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-sm"
                  : "text-text-tertiary hover:text-text-primary border border-transparent"
              }`}
            >
              All
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-text-tertiary/10 text-text-tertiary">
                {threads.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("priority")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-md)] cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                activeTab === "priority"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-sm"
                  : "text-text-tertiary hover:text-text-primary border border-transparent"
              }`}
            >
              Priority
              {priorityThreads.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-accent-primary/10 text-accent-primary">
                  {priorityThreads.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("other")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-md)] cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                activeTab === "other"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-sm"
                  : "text-text-tertiary hover:text-text-primary border border-transparent"
              }`}
            >
              Digest
              {otherThreads.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-text-tertiary/10 text-text-tertiary">
                  {otherThreads.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("sent")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-md)] cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                activeTab === "sent"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-sm"
                  : "text-text-tertiary hover:text-text-primary border border-transparent"
              }`}
            >
              Sent
              {sentThreads.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-text-tertiary/10 text-text-tertiary">
                  {sentThreads.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("drafts")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-md)] cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                activeTab === "drafts"
                  ? "bg-bg-surface text-text-primary border border-border-default shadow-sm"
                  : "text-text-tertiary hover:text-text-primary border border-transparent"
              }`}
            >
              Drafts
              {draftThreads.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-text-tertiary/10 text-text-tertiary">
                  {draftThreads.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Account Filter Pills */}
        {gmailStatus?.connected && gmailStatus.accounts && gmailStatus.accounts.length > 1 && (
          <div className="flex gap-1.5 px-3.5 py-2 border-b border-border-subtle bg-bg-raised/20 overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setSelectedEmailFilter("all")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                selectedEmailFilter === "all"
                  ? "bg-bg-surface text-text-primary border-border-default shadow-sm"
                  : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary"
              }`}
            >
              All Accounts
            </button>
            {gmailStatus.accounts.map((acc: any) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedEmailFilter(acc.emailAddress)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md border cursor-pointer transition-all duration-[var(--transition-fast)] shrink-0 ${
                  selectedEmailFilter === acc.emailAddress
                    ? "bg-bg-surface text-text-primary border-border-default shadow-sm"
                    : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary"
                }`}
              >
                {acc.emailAddress}
              </button>
            ))}
          </div>
        )}

        {/* Smart Priority Digest Box */}
        {activeTab === "other" && gmailStatus?.connected && threads && (
          <div className="px-4 py-3.5 border-b border-border-subtle bg-bg-raised/15 flex flex-col gap-1.5 shrink-0 animate-fade-in">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Smart Low Priority Digest
            </span>
            <p className="text-[11px] leading-relaxed text-text-secondary">
              Newsletters, receipts, system updates, and automated notifications are grouped here to protect your workspace focus.
            </p>
          </div>
        )}

        {/* Priority Instructions Box */}
        {activeTab === "priority" && gmailStatus?.connected && threads && (
          <div className="px-4 py-3 border-b border-border-subtle bg-bg-raised/10 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                Custom Priority Criteria
              </span>
              {!isEditingRules && dbPriorityRules && (
                <button
                  onClick={() => setIsEditingRules(true)}
                  className="text-[11px] font-semibold text-accent-primary hover:underline cursor-pointer"
                >
                  Edit Rules
                </button>
              )}
            </div>

            {isEditingRules || !dbPriorityRules ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={priorityInput}
                  onChange={(e) => setPriorityInput(e.target.value)}
                  placeholder="Describe what emails you want to see here (e.g., 'emails from Upwork, messages about billing, direct client requests'). Let the LLM handle the rest."
                  rows={2}
                  className="w-full text-xs bg-bg-surface border border-border-default rounded-[var(--radius-md)] p-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/60 resize-none font-medium leading-relaxed"
                />
                <div className="flex gap-2 justify-end">
                  {dbPriorityRules && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs font-semibold py-1 px-2.5"
                      onClick={() => {
                        setPriorityInput(dbPriorityRules);
                        setIsEditingRules(false);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-7 text-xs font-semibold py-1 px-2.5"
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
              <div className="bg-bg-surface border border-border-subtle rounded-[var(--radius-md)] p-2 text-xs text-text-secondary italic leading-relaxed shadow-sm font-medium">
                "{dbPriorityRules}"
              </div>
            )}
          </div>
        )}

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <ThreadListSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <p className="text-sm text-accent-danger">
                Failed to load threads.
              </p>
              <p className="text-xs text-text-tertiary">
                {error.message}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : !gmailStatus?.connected ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center animate-fade-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-primary/10 border border-accent-primary/20">
                <InboxIcon />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-text-primary">
                  Connect your Gmail
                </p>
                <p className="text-xs text-text-tertiary leading-relaxed max-w-[220px]">
                  Authorize Singularity to access your inbox and supercharge your workflow.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="font-semibold shadow-[var(--shadow-glow)]"
                onClick={() => {
                  window.location.href = "/api/connect?plugin=gmail";
                }}
              >
                Connect Gmail
              </Button>
            </div>
          ) : (gmailStatus?.connected && threads && threads.length === 0 && activeTab === "all") ? (
            <div className="flex flex-col justify-center h-full p-6 text-left animate-fade-in max-w-sm mx-auto">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-primary/10 border border-accent-primary/20">
                <svg className="h-6 w-6 text-accent-primary animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-text-primary mb-2">Workspace Connected!</h2>
              <p className="text-xs text-text-secondary leading-relaxed mb-6">
                Your Gmail account is successfully linked. Follow these quick steps to get started:
              </p>
              <div className="space-y-4 mb-6">
                <div className="flex gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-bg-surface border border-border-default text-[10px] font-bold text-accent-primary">1</div>
                  <div>
                    <h3 className="text-xs font-semibold text-text-primary">Sync Your Inbox</h3>
                    <p className="text-[11px] text-text-tertiary leading-relaxed mt-0.5">Click the sync button below to download your latest conversations.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-bg-surface border border-border-default text-[10px] font-bold text-accent-primary">2</div>
                  <div>
                    <h3 className="text-xs font-semibold text-text-primary">Configure AI Priority Rules</h3>
                    <p className="text-[11px] text-text-tertiary leading-relaxed mt-0.5">Switch to the "Priority" tab to set criteria for labeling urgent/important emails.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-bg-surface border border-border-default text-[10px] font-bold text-accent-primary">3</div>
                  <div>
                    <h3 className="text-xs font-semibold text-text-primary">Keyboard Shortcuts</h3>
                    <p className="text-[11px] text-text-tertiary leading-relaxed mt-0.5">Use <kbd className="px-1 py-0.5 text-[9px] bg-bg-surface border border-border-default rounded text-text-secondary">R</kbd> to reply, <kbd className="px-1 py-0.5 text-[9px] bg-bg-surface border border-border-default rounded text-text-secondary">E</kbd> to archive, and <kbd className="px-1 py-0.5 text-[9px] bg-bg-surface border border-border-default rounded text-text-secondary">#</kbd> to delete.</p>
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                className="w-full justify-center text-xs font-bold uppercase tracking-wider h-9 shadow-[var(--shadow-glow)]"
                onClick={handleRefresh}
                isLoading={isRefreshing}
              >
                Sync Inbox Now
              </Button>
            </div>
          ) : visibleThreads.length > 0 ? (
            <div className="flex flex-col gap-0.5 p-1.5">
              {visibleThreads.map((thread) => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === selectedThreadId}
                  onSelect={() => setSelectedThreadId(thread.id)}
                  onArchive={() => archiveMutation.mutate({ id: thread.entityId })}
                  onDelete={() => deleteMutation.mutate({ id: thread.entityId })}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center animate-fade-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-bg-surface border border-border-default">
                <InboxIcon />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-text-primary">
                  {activeTab === "priority" 
                    ? "🎉 Inbox Zero!" 
                    : activeTab === "sent" 
                    ? "No sent messages" 
                    : activeTab === "drafts" 
                    ? "No drafts" 
                    : "Nothing here yet"}
                </p>
                <p className="text-xs text-text-tertiary leading-relaxed max-w-[220px]">
                  {activeTab === "priority" 
                    ? "You've cleared your priority inbox. Keep it up!" 
                    : activeTab === "sent" 
                    ? "Emails you send will appear here." 
                    : activeTab === "drafts" 
                    ? "Your saved drafts will appear here." 
                    : "No emails in this section yet."}
                </p>
              </div>
              {activeTab === "other" && threads && threads.length === 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRefresh}
                  isLoading={isRefreshing}
                >
                  Sync Inbox
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Right Panel: Thread Detail ---- */}
      <div className="flex-1 flex flex-col bg-bg-base min-w-0">
        {selectedThread ? (
          <ThreadDetail
            thread={selectedThread}
            onArchive={handleArchive}
            onDelete={handleDelete}
            isArchiving={archiveMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent-primary/10 border border-accent-primary/20">
              <InboxIcon />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-text-primary">Select a conversation</p>
              <p className="text-xs text-text-tertiary max-w-[200px] leading-relaxed">Choose an email from the left to read and reply</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
