"use client";

import { useMemo, useRef, useState, useEffect, useCallback, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/app/_components/ui/button";
import { api, type RouterOutputs } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";
import { FormattedMessage } from "./formatted-message";

type AgentAction = RouterOutputs["agent"]["chat"]["actions"][number];

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  reasoning?: string;
  actions?: AgentAction[];
  timestamp: number; // epoch ms
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function SparkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.25 8.25 18 9.25l-.25-1a2 2 0 0 0-1.25-1.25l-1-.25 1-.25a2 2 0 0 0 1.25-1.25l.25-1 .25 1a2 2 0 0 0 1.25 1.25l1 .25-1 .25a2 2 0 0 0-1.25 1.25ZM17.5 20l-.5 1.75L16.5 20a2.5 2.5 0 0 0-1.75-1.75L13 17.75l1.75-.5A2.5 2.5 0 0 0 16.5 15.5l.5-1.75.5 1.75a2.5 2.5 0 0 0 1.75 1.75l1.75.5-1.75.5A2.5 2.5 0 0 0 17.5 20Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

// ─── Thinking Bar ────────────────────────────────────────────────────────────

const THINKING_PHRASES = [
  "Understanding your request…",
  "Searching through your data…",
  "Analyzing context…",
  "Querying tools…",
  "Reasoning about the best approach…",
  "Composing a response…",
  "Almost there…",
];

function ThinkingBar() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 3000);
    return () => clearInterval(phraseInterval);
  }, []);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="bg-bg-surface rounded-[var(--radius-md)] px-3 py-2.5 max-w-[92%]">
        {/* Animated bar */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex gap-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs font-medium text-text-secondary tracking-wide uppercase">Thinking</span>
        </div>
        {/* Status phrase */}
        <p className="text-xs text-text-tertiary transition-all duration-300" key={phraseIndex}>
          {THINKING_PHRASES[phraseIndex]}
        </p>
        {/* Progress shimmer */}
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-bg-inset">
          <div className="h-full w-1/3 rounded-full bg-text-tertiary/40 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actionNeedsConfirmation(action: AgentAction) {
  return (
    action.type === "confirm_archive_threads" ||
    action.type === "confirm_delete_threads"
  );
}

function formatMessageTime(epochMs: number): string {
  const d = new Date(epochMs);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function parseOptionsAndCleanText(text: string) {
  const options: string[] = [];
  const regex = /\[(?:Option|Choice|Select):\s*(.*?)\]/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      options.push(match[1].trim());
    }
  }
  const cleanText = text.replace(regex, "").trim();
  return { cleanText, options };
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export function AgentPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const utils = api.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get active session userId
  const { data: sessionData } = authClient.useSession();
  const userId = sessionData?.user?.id;

  // Load threads from localStorage when userId is resolved or when panel opens
  useEffect(() => {
    if (!userId || !isOpen) return;

    const savedThreads = localStorage.getItem(`singularity_chat_threads_${userId}`);
    const savedActiveId = localStorage.getItem(`singularity_active_thread_id_${userId}`);

    let loadedThreads: ChatThread[] = [];
    if (savedThreads) {
      try {
        loadedThreads = JSON.parse(savedThreads) as ChatThread[];
      } catch {
        // ignore
      }
    }

    if (loadedThreads.length === 0) {
      const defaultId = crypto.randomUUID();
      loadedThreads = [
        {
          id: defaultId,
          title: "New Conversation",
          messages: [
            {
              id: "welcome",
              role: "assistant",
              text: "Ask me to summarize mail, prep your calendar, draft a reply, or queue actions for approval.",
              timestamp: Date.now(),
            },
          ],
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem(`singularity_chat_threads_${userId}`, JSON.stringify(loadedThreads));
      localStorage.setItem(`singularity_active_thread_id_${userId}`, defaultId);
      setActiveThreadId(defaultId);
    } else {
      const activeId = savedActiveId && loadedThreads.some((t) => t.id === savedActiveId)
        ? savedActiveId
        : loadedThreads[0]?.id ?? null;
      setActiveThreadId(activeId);
    }

    setThreads(loadedThreads);
  }, [userId, isOpen]);

  const saveThreadsToStorage = useCallback((updatedThreads: ChatThread[]) => {
    if (!userId) return;
    localStorage.setItem(`singularity_chat_threads_${userId}`, JSON.stringify(updatedThreads));
    setThreads(updatedThreads);
  }, [userId]);

  const saveActiveThreadIdToStorage = useCallback((id: string) => {
    if (!userId) return;
    localStorage.setItem(`singularity_active_thread_id_${userId}`, id);
    setActiveThreadId(id);
  }, [userId]);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) ?? null;
  }, [threads, activeThreadId]);

  const messages = activeThread?.messages ?? [];

  // Auto-scroll to bottom on new messages or when thinking
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNewChat = useCallback(() => {
    const newId = crypto.randomUUID();
    const newThread: ChatThread = {
      id: newId,
      title: "New Conversation",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          text: "Ask me to summarize mail, prep your calendar, draft a reply, or queue actions for approval.",
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
    };

    const updated = [newThread, ...threads];
    saveThreadsToStorage(updated);
    saveActiveThreadIdToStorage(newId);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [threads, saveThreadsToStorage, saveActiveThreadIdToStorage]);

  const chat = api.agent.chat.useMutation({
    onSuccess: (data) => {
      if (!activeThreadId) return;

      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.text,
        reasoning: data.reasoning ?? undefined,
        actions: data.actions,
        timestamp: Date.now(),
      };

      const updated = threads.map((t) => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      });

      saveThreadsToStorage(updated);

      if (data.sentEmail) {
        setTimeout(() => {
          setIsOpen(false);
          router.push("/inbox?tab=sent");
        }, 1500);
      } else if (data.createdDraft) {
        setTimeout(() => {
          setIsOpen(false);
          router.push("/inbox?tab=drafts");
        }, 1500);
      }
    },
    onError: (error) => {
      if (!activeThreadId) return;
      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        text: error.message,
        timestamp: Date.now(),
      };
      const updated = threads.map((t) => {
        if (t.id === activeThreadId) {
          return { ...t, messages: [...t.messages, newMsg] };
        }
        return t;
      });
      saveThreadsToStorage(updated);
    },
  });

  // Auto-scroll while thinking
  useEffect(() => {
    if (chat.isPending) {
      const timer = setInterval(scrollToBottom, 500);
      return () => clearInterval(timer);
    }
  }, [chat.isPending, scrollToBottom]);

  const confirmAction = api.agent.confirmAction.useMutation({
    onSuccess: async (data) => {
      if (!activeThreadId) return;

      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        text: data.message,
        timestamp: Date.now(),
      };

      const updated = threads.map((t) => {
        if (t.id === activeThreadId) {
          return {
            ...t,
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      });

      saveThreadsToStorage(updated);
      await utils.gmail.listThreads.invalidate();
      await utils.calendar.listEvents.invalidate();
    },
    onError: (error) => {
      if (!activeThreadId) return;
      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        text: error.message,
        timestamp: Date.now(),
      };
      const updated = threads.map((t) => {
        if (t.id === activeThreadId) {
          return { ...t, messages: [...t.messages, newMsg] };
        }
        return t;
      });
      saveThreadsToStorage(updated);
    },
  });

  const quickPrompts = useMemo(
    () => [
      "What should I handle first?",
      "Summarize today",
      "Draft a concise reply",
    ],
    [],
  );

  function submitMessage(nextMessage = input) {
    const trimmed = nextMessage.trim();
    if (!trimmed || chat.isPending || !activeThreadId || !activeThread) return;

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      timestamp: Date.now(),
    };

    // Calculate title update if first message
    const isFirstUserMessage = activeThread.messages.filter((m) => m.role === "user").length === 0;
    const threadTitle = isFirstUserMessage
      ? trimmed.length > 25
        ? trimmed.slice(0, 24) + "…"
        : trimmed
      : activeThread.title;

    const updatedMessages = [...activeThread.messages, newMsg];

    const updatedThreads = threads.map((t) => {
      if (t.id === activeThreadId) {
        return {
          ...t,
          title: threadTitle,
          messages: updatedMessages,
        };
      }
      return t;
    });

    saveThreadsToStorage(updatedThreads);
    setInput("");

    chat.mutate({
      message: trimmed,
      history: updatedMessages.map((m) => ({
        role: m.role,
        content: m.text,
        reasoning: m.reasoning,
      })),
      context: {
        route: pathname,
      },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  async function runAction(action: AgentAction) {
    if (action.type === "open_route") {
      router.push(action.href);
      setIsOpen(false);
      return;
    }

    if (action.type === "refresh_inbox") {
      await utils.gmail.listThreads.invalidate();
      if (activeThreadId) {
        const newMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          text: "Inbox refresh queued.",
          timestamp: Date.now(),
        };
        const updated = threads.map((t) => {
          if (t.id === activeThreadId) {
            return { ...t, messages: [...t.messages, newMsg] };
          }
          return t;
        });
        saveThreadsToStorage(updated);
      }
      return;
    }

    if (action.type === "refresh_calendar") {
      await utils.calendar.listEvents.invalidate();
      if (activeThreadId) {
        const newMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          text: "Calendar refresh queued.",
          timestamp: Date.now(),
        };
        const updated = threads.map((t) => {
          if (t.id === activeThreadId) {
            return { ...t, messages: [...t.messages, newMsg] };
          }
          return t;
        });
        saveThreadsToStorage(updated);
      }
      return;
    }

    if (action.type === "show_draft") {
      if (activeThreadId) {
        const newMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          text: [
            action.payload.to ? `To: ${action.payload.to}` : null,
            action.payload.subject ? `Subject: ${action.payload.subject}` : null,
            action.payload.body,
          ]
            .filter(Boolean)
            .join("\n"),
          timestamp: Date.now(),
        };
        const updated = threads.map((t) => {
          if (t.id === activeThreadId) {
            return { ...t, messages: [...t.messages, newMsg] };
          }
          return t;
        });
        saveThreadsToStorage(updated);
      }
      return;
    }

    confirmAction.mutate(action);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 120);
        }}
        className="bg-accent-primary hover:bg-accent-primary-hover fixed right-5 bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-full text-text-inverse shadow-[var(--shadow-lg)] transition-all duration-150 hover:scale-105 active:scale-95"
        aria-label="Open agent chat"
      >
        <SparkIcon />
      </button>

      {/* Chat slide-out panel */}
      {isOpen && (
        <div className="animate-fade-in fixed inset-0 z-50 flex justify-end bg-black/20">
          {/* Backdrop dismiss */}
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close agent chat backdrop"
            onClick={() => setIsOpen(false)}
          />

          <aside className="border-border-default bg-bg-raised animate-slide-right flex h-full w-full max-w-[420px] flex-col border-l shadow-[var(--shadow-xl)]">
            {/* Header */}
            <header className="border-border-subtle flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-3">
                <div className="bg-accent-primary/15 text-accent-primary flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)]">
                  <SparkIcon />
                </div>
                <div>
                  <h2 className="text-text-primary text-sm font-semibold">Agent</h2>
                  <p className="text-text-tertiary text-[10px] font-mono">{pathname}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="text-text-tertiary hover:bg-bg-surface hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors"
                  aria-label="New chat"
                  title="New Chat"
                >
                  <PlusIcon />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/agent?threadId=${activeThreadId}`);
                  }}
                  className="text-text-tertiary hover:bg-bg-surface hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors"
                  aria-label="Expand to full screen"
                  title="Expand to Full Screen"
                >
                  <ExpandIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-text-tertiary hover:bg-bg-surface hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors"
                  aria-label="Close agent chat"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
              {messages.map((message, idx) => {
                // Show date separator between messages on different days
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateSep =
                  !prevMsg ||
                  new Date(message.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                return (
                  <div key={message.id} className="space-y-1.5">
                    {showDateSep && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 h-px bg-border-subtle" />
                        <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                          {new Date(message.timestamp).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <div className="flex-1 h-px bg-border-subtle" />
                      </div>
                    )}

                    {/* Message bubble */}
                    {(() => {
                      const { cleanText, options } = parseOptionsAndCleanText(message.text);
                      return (
                        <div
                          className={`flex flex-col ${
                            message.role === "user" ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[88%] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                              message.role === "user"
                                ? "bg-accent-primary text-text-inverse whitespace-pre-wrap"
                                : message.role === "system"
                                  ? "bg-bg-inset text-text-secondary border border-border-subtle font-mono"
                                  : "bg-bg-surface text-text-primary border border-border-subtle/80"
                            }`}
                          >
                            <FormattedMessage
                              role={message.role}
                              text={cleanText}
                              reasoning={message.reasoning}
                            />
                          </div>

                          {/* Option Buttons */}
                          {options.length > 0 && message.role === "assistant" && (
                            <div className="flex flex-wrap gap-2 mt-2 max-w-[88%]">
                              {options.map((opt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => submitMessage(opt)}
                                  className="border border-accent-primary text-accent-primary hover:bg-accent-primary/10 bg-bg-surface rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Timestamp */}
                          <span className="text-[10px] text-text-tertiary mt-0.5 px-1">
                            {formatMessageTime(message.timestamp)}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Action cards */}
                    {message.actions?.length ? (
                      <div className="space-y-2 mt-1">
                        {message.actions.map((action, actionIdx) => (
                          <div
                            key={`${message.id}-${action.type}-${actionIdx}`}
                            className="border-border-subtle bg-bg-overlay rounded-[var(--radius-md)] border p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-text-primary text-sm font-medium">
                                  {action.label}
                                </p>
                                <p className="text-text-tertiary mt-1 text-xs">
                                  {actionNeedsConfirmation(action)
                                    ? "Needs your approval before it changes Gmail."
                                    : "Runs in the current app session."}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={actionNeedsConfirmation(action) ? "danger" : "secondary"}
                                isLoading={confirmAction.isPending}
                                onClick={() => void runAction(action)}
                              >
                                {actionNeedsConfirmation(action) ? "Approve" : "Run"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* ─── Thinking Bar ─── */}
              {chat.isPending && <ThinkingBar />}
            </div>

            {/* Input area */}
            <div className="border-border-subtle border-t p-3">
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitMessage(prompt)}
                    className="border-border-subtle text-text-secondary hover:bg-bg-surface hover:text-text-primary rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Ask the agent..."
                  className="border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary min-h-11 flex-1 resize-none rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors outline-none"
                />
                <Button type="submit" isLoading={chat.isPending}>
                  Send
                </Button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
