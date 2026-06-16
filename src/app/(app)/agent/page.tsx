"use client";

import { useMemo, useRef, useState, useEffect, useCallback, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type RouterOutputs } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";
import { Button } from "@/app/_components/ui/button";
import { FormattedMessage } from "@/app/_components/agent/formatted-message";

type AgentAction = RouterOutputs["agent"]["chat"]["actions"][number];

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  reasoning?: string;
  actions?: AgentAction[];
  timestamp: number;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function SparkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.25 8.25 18 9.25l-.25-1a2 2 0 0 0-1.25-1.25l-1-.25 1-.25a2 2 0 0 0 1.25-1.25l.25-1 .25 1a2 2 0 0 0 1.25 1.25l1 .25-1 .25a2 2 0 0 0-1.25 1.25ZM17.5 20l-.5 1.75L16.5 20a2.5 2.5 0 0 0-1.75-1.75L13 17.75l1.75-.5A2.5 2.5 0 0 0 16.5 15.5l.5-1.75.5 1.75a2.5 2.5 0 0 0 1.75 1.75l1.75.5-1.75.5A2.5 2.5 0 0 0 17.5 20Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 3000);
    return () => clearInterval(phraseInterval);
  }, []);

  return (
    <div className="flex items-start gap-2 animate-fade-in max-w-2xl">
      <div className="bg-bg-surface rounded-[var(--radius-md)] px-4 py-3 border border-border-subtle shadow-sm w-full">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex gap-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Thinking</span>
        </div>
        <p className="text-xs text-text-tertiary">{THINKING_PHRASES[phraseIndex]}</p>
        <div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-bg-inset">
          <div className="h-full w-1/3 rounded-full bg-text-tertiary/40 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actionNeedsConfirmation(action: AgentAction) {
  return action.type === "confirm_archive_threads" || action.type === "confirm_delete_threads";
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

// ─── Main Page ────────────────────────────────────────────────────────────────

function AgentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const { data: sessionData } = authClient.useSession();
  const userId = sessionData?.user?.id;

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isReasoningEnabled, setIsReasoningEnabled] = useState(false);
  const [customInputMsgId, setCustomInputMsgId] = useState<string | null>(null);
  const [customInputVal, setCustomInputVal] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load threads from localStorage
  useEffect(() => {
    if (!userId) return;

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
      // Create a default thread if none exist
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
      // Determine active thread
      const paramId = searchParams.get("threadId");
      const activeId = paramId && loadedThreads.some((t) => t.id === paramId)
        ? paramId
        : savedActiveId && loadedThreads.some((t) => t.id === savedActiveId)
          ? savedActiveId
          : loadedThreads[0]?.id ?? null;

      setActiveThreadId(activeId);
    }

    setThreads(loadedThreads);
  }, [userId, searchParams]);

  // Save threads to localStorage on change
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

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Create new conversation
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
    router.replace(`/agent?threadId=${newId}`);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [threads, saveThreadsToStorage, saveActiveThreadIdToStorage, router]);

  // Delete a conversation thread
  const handleDeleteThread = useCallback((threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const filtered = threads.filter((t) => t.id !== threadId);
    saveThreadsToStorage(filtered);

    if (activeThreadId === threadId) {
      if (filtered.length > 0) {
        const nextActive = filtered[0]?.id ?? null;
        if (nextActive) {
          saveActiveThreadIdToStorage(nextActive);
          router.replace(`/agent?threadId=${nextActive}`);
        }
      } else {
        // Recalculate default
        localStorage.removeItem(`singularity_chat_threads_${userId}`);
        window.location.reload();
      }
    }
  }, [threads, activeThreadId, saveThreadsToStorage, saveActiveThreadIdToStorage, userId, router]);

  // TRPC Mutations
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
        text: `Action failed: ${error.message}`,
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

  const chatMutation = api.agent.chat.useMutation({
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
    },
    onError: (error) => {
      if (!activeThreadId) return;
      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        text: `Failed: ${error.message}`,
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

  // Auto-scroll while waiting for LLM
  useEffect(() => {
    if (chatMutation.isPending) {
      const timer = setInterval(scrollToBottom, 500);
      return () => clearInterval(timer);
    }
  }, [chatMutation.isPending, scrollToBottom]);

  const submitMessage = useCallback((textToSend = input) => {
    const trimmed = textToSend.trim();
    if (!trimmed || chatMutation.isPending || !activeThreadId || !activeThread) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      timestamp: Date.now(),
    };

    // Calculate title update if it's the first message
    const isFirstUserMessage = activeThread.messages.filter((m) => m.role === "user").length === 0;
    const threadTitle = isFirstUserMessage
      ? trimmed.length > 25
        ? trimmed.slice(0, 24) + "…"
        : trimmed
      : activeThread.title;

    const updatedMessages = [...activeThread.messages, userMsg];

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

    chatMutation.mutate({
      message: trimmed,
      history: updatedMessages.map((m) => ({
        role: m.role,
        content: m.text,
      })),
      context: {
        route: "/agent",
      },
      reasoningEnabled: isReasoningEnabled,
    });
  }, [input, activeThreadId, activeThread, threads, chatMutation, saveThreadsToStorage, isReasoningEnabled]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const runAction = async (action: AgentAction) => {
    if (action.type === "open_route") {
      router.push(action.href);
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
  };

  const quickPrompts = useMemo(
    () => [
      "What should I handle first?",
      "Summarize today's inbox",
      "List upcoming calendar events",
    ],
    []
  );

  return (
    <div className="flex h-full animate-fade-in overflow-hidden">
      {/* ──── Left Panel: Conversation History ──── */}
      <div className="w-[260px] shrink-0 flex flex-col border-r border-border-default bg-bg-raised">
        {/* Header/New Chat */}
        <div className="p-3.5 border-b border-border-subtle flex flex-col gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 border border-border-default hover:bg-bg-surface text-text-primary text-xs font-semibold uppercase tracking-wider py-2.5 rounded-xl cursor-pointer"
          >
            <PlusIcon />
            New Conversation
          </Button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {threads.map((thread) => {
            const isSelected = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                onClick={() => {
                  saveActiveThreadIdToStorage(thread.id);
                  router.replace(`/agent?threadId=${thread.id}`);
                }}
                className={`flex items-center justify-between group px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-[var(--transition-fast)] ${
                  isSelected
                    ? "bg-bg-surface border border-border-subtle"
                    : "hover:bg-bg-surface/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <SparkIcon />
                  <span className={`text-xs truncate ${isSelected ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                    {thread.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteThread(thread.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 rounded p-1 text-text-tertiary transition-all duration-[var(--transition-fast)] cursor-pointer"
                  title="Delete conversation"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──── Right Panel: Chat Feed ──── */}
      <div className="flex-1 flex flex-col bg-bg-base overflow-hidden">
        {/* Active Title Header */}
        <div className="h-14 shrink-0 flex items-center border-b border-border-subtle px-6 justify-between bg-bg-base">
          <h1 className="text-sm font-semibold text-text-primary truncate">
            {activeThread?.title ?? "Agent Chat"}
          </h1>
        </div>

        {/* Messages Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 px-6 space-y-4">
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((message, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showDateSep =
                !prevMsg ||
                new Date(message.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

              const { cleanText, options } = parseOptionsAndCleanText(message.text);

              return (
                <div key={message.id} className="space-y-2.5">
                  {showDateSep && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-border-subtle" />
                      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                        {new Date(message.timestamp).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-border-subtle" />
                    </div>
                  )}

                  <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[90%] rounded-xl px-4 py-3 text-[13px] leading-relaxed shadow-sm border ${
                        message.role === "user"
                          ? "bg-accent-primary text-text-inverse border-accent-primary whitespace-pre-wrap"
                          : message.role === "system"
                            ? "bg-bg-inset text-text-secondary border-border-subtle font-mono"
                            : "bg-bg-surface text-text-primary border-border-subtle/85"
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
                      <div className="flex flex-wrap gap-2 mt-2 max-w-[90%] items-center">
                        {options.map((opt, idx) => {
                          const isCustom = opt.toLowerCase().includes("custom") || opt.toLowerCase().includes("specify");
                          if (isCustom && customInputMsgId === message.id) {
                            return (
                              <div key={idx} className="flex gap-2 items-center bg-bg-surface border border-accent-primary/45 rounded-xl p-1 animate-fade-in w-full max-w-sm">
                                <input
                                  type="text"
                                  value={customInputVal}
                                  onChange={(e) => setCustomInputVal(e.target.value)}
                                  placeholder="Type your custom response..."
                                  className="bg-transparent text-xs text-text-primary px-2 py-1 outline-none border-none flex-1 min-w-0"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      submitMessage(customInputVal);
                                      setCustomInputMsgId(null);
                                      setCustomInputVal("");
                                    }
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    submitMessage(customInputVal);
                                    setCustomInputMsgId(null);
                                    setCustomInputVal("");
                                  }}
                                  className="bg-accent-primary text-text-inverse text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer shrink-0"
                                >
                                  Submit
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                      if (isCustom) {
                                        setCustomInputMsgId(message.id);
                                        setCustomInputVal("");
                                      } else {
                                        submitMessage(opt);
                                      }
                                    }}
                              className="border border-accent-primary text-accent-primary hover:bg-accent-primary/10 bg-bg-surface rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <span className="text-[10px] text-text-tertiary mt-1 px-1 tabular-nums">
                      {formatMessageTime(message.timestamp)}
                    </span>
                  </div>

                  {/* Actions */}
                  {message.actions?.length ? (
                    <div className="space-y-2 mt-1">
                      {message.actions.map((action, actionIdx) => (
                        <div
                          key={`${message.id}-${action.type}-${actionIdx}`}
                          className="border-border-subtle bg-bg-overlay rounded-xl border p-4 shadow-sm max-w-xl animate-fade-in"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-text-primary text-sm font-semibold">
                                {action.label}
                              </p>
                              <p className="text-text-tertiary mt-1 text-xs leading-relaxed">
                                {actionNeedsConfirmation(action)
                                  ? "Requires your approval before modifying external accounts."
                                  : "Executes in current session context."}
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

            {/* Thinking status */}
            {chatMutation.isPending && <ThinkingBar />}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border-subtle p-6 bg-bg-base shrink-0">
          <div className="max-w-2xl mx-auto">
            {/* Quick prompts */}
            <div className="mb-4 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitMessage(prompt)}
                  className="border border-border-default text-text-secondary hover:bg-bg-surface hover:text-text-primary rounded-full px-3 py-1.5 text-xs transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-border-default bg-bg-inset p-2.5 focus-within:border-accent-primary transition-colors focus-within:bg-bg-base">
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
                placeholder="Ask the agent to summarize emails, schedule events..."
                className="bg-transparent text-text-primary placeholder:text-text-tertiary w-full resize-none px-2 py-1 text-sm outline-none border-none focus:ring-0"
              />
              <div className="flex items-center justify-between px-1 border-t border-border-subtle/50 pt-2.5">
                {/* Deepthink Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReasoningEnabled(!isReasoningEnabled)}
                    title="Use Flash model for fast response and Pro model for more in depth response"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isReasoningEnabled
                        ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/25"
                        : "text-text-tertiary hover:text-text-secondary border border-transparent"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547Z" />
                    </svg>
                    Deepthink
                  </button>
                  <span className="text-[10.5px] text-text-tertiary hidden sm:inline-block leading-none">
                    {isReasoningEnabled 
                      ? "Pro model: in-depth response" 
                      : "Flash model: fast response"}
                  </span>
                </div>

                <Button
                  type="submit"
                  isLoading={chatMutation.isPending}
                  size="sm"
                  className="font-semibold px-5 py-2"
                >
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-bg-base text-text-secondary">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">Loading Agent...</span>
        </div>
      </div>
    }>
      <AgentPageContent />
    </Suspense>
  );
}
