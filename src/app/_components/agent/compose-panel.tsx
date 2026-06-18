"use client";

import { useMemo, useRef, useState, useEffect, useCallback, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/app/_components/ui/button";
import { api } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";
import { FormattedMessage } from "./formatted-message";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  reasoning?: string;
  timestamp: number;
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

// ─── Thinking Bar ────────────────────────────────────────────────────────────

function ThinkingBar() {
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="bg-bg-surface rounded-[var(--radius-md)] px-3 py-2.5 max-w-[92%]">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex gap-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-[10px] font-medium text-text-secondary tracking-wide uppercase">Thinking</span>
        </div>
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-bg-inset">
          <div className="h-full w-1/3 rounded-full bg-text-tertiary/40 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseDraftFromResponse = (text: string) => {
  const draftMatch = text.match(/---DRAFT_START---([\s\S]*?)---DRAFT_END---/i);
  if (!draftMatch) return { to: null, subject: null, cc: null, bcc: null, body: null };

  const draftText = draftMatch[1] ?? "";
  const toMatch = draftText.match(/To:[ \t]*(.*)/i);
  const subjectMatch = draftText.match(/Subject:[ \t]*(.*)/i);
  const ccMatch = draftText.match(/Cc:[ \t]*(.*)/i);
  const bccMatch = draftText.match(/Bcc:[ \t]*(.*)/i);
  const bodyMatch = draftText.match(/Body:\s*([\s\S]*)$/i);

  let body = bodyMatch ? bodyMatch[1]?.trim() : null;
  if (body) {
    // Strip markdown code fences if wrapped
    body = body.replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "");
  }

  return {
    to: toMatch ? toMatch[1]?.trim() : null,
    subject: subjectMatch ? subjectMatch[1]?.trim() : null,
    cc: ccMatch ? ccMatch[1]?.trim() : null,
    bcc: bccMatch ? bccMatch[1]?.trim() : null,
    body,
  };
};

function formatMessageTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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

export function ComposePanel() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Left column editor state
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const { data: gmailStatus } = api.gmail.getConnectionStatus.useQuery(undefined, {
    enabled: isOpen,
  });

  useEffect(() => {
    if (gmailStatus?.accounts && gmailStatus.accounts.length > 0 && !fromEmail) {
      setFromEmail(gmailStatus.accounts[0]?.emailAddress ?? "");
    }
  }, [gmailStatus, fromEmail]);

  // Autocomplete Suggestions State
  const { data: contacts } = api.gmail.getContacts.useQuery(undefined, {
    enabled: isOpen,
  });

  const [toSuggestions, setToSuggestions] = useState<NonNullable<typeof contacts>>([]);
  const [ccSuggestions, setCcSuggestions] = useState<NonNullable<typeof contacts>>([]);
  const [bccSuggestions, setBccSuggestions] = useState<NonNullable<typeof contacts>>([]);

  const [activeSuggestionField, setActiveSuggestionField] = useState<"to" | "cc" | "bcc" | null>(null);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(0);

  const handleInputChange = (field: "to" | "cc" | "bcc", val: string) => {
    if (field === "to") setTo(val);
    else if (field === "cc") setCc(val);
    else if (field === "bcc") setBcc(val);

    if (!contacts) return;

    // Get the last typed part after the last comma
    const parts = val.split(",");
    const lastPart = parts[parts.length - 1]?.trim() ?? "";

    if (lastPart.length < 1) {
      if (field === "to") setToSuggestions([]);
      else if (field === "cc") setCcSuggestions([]);
      else if (field === "bcc") setBccSuggestions([]);
      setActiveSuggestionField(null);
      return;
    }

    const filtered = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(lastPart.toLowerCase()) ||
        c.email.toLowerCase().includes(lastPart.toLowerCase())
    );

    if (field === "to") setToSuggestions(filtered.slice(0, 5));
    else if (field === "cc") setCcSuggestions(filtered.slice(0, 5));
    else if (field === "bcc") setBccSuggestions(filtered.slice(0, 5));

    if (filtered.length > 0) {
      setActiveSuggestionField(field);
      setFocusedSuggestionIndex(0);
    } else {
      setActiveSuggestionField(null);
    }
  };

  const selectSuggestion = (field: "to" | "cc" | "bcc", email: string, name?: string) => {
    const currentValue = field === "to" ? to : field === "cc" ? cc : bcc;
    const parts = currentValue.split(",");
    
    // Format: name <email> or email
    const formattedContact = name ? `${name} <${email}>` : email;
    parts[parts.length - 1] = formattedContact;
    
    const newVal = parts.join(", ") + ", ";
    
    if (field === "to") {
      setTo(newVal);
      setToSuggestions([]);
    } else if (field === "cc") {
      setCc(newVal);
      setCcSuggestions([]);
    } else if (field === "bcc") {
      setBcc(newVal);
      setBccSuggestions([]);
    }
    setActiveSuggestionField(null);
  };

  const handleInputKeyDown = (field: "to" | "cc" | "bcc", e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeSuggestionField !== field) return;
    const suggestions = field === "to" ? toSuggestions : field === "cc" ? ccSuggestions : bccSuggestions;
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const focused = suggestions[focusedSuggestionIndex];
      if (focused) {
        selectSuggestion(field, focused.email, focused.name);
      }
    } else if (e.key === "Escape") {
      setActiveSuggestionField(null);
    }
  };

  const renderSuggestions = (field: "to" | "cc" | "bcc") => {
    if (activeSuggestionField !== field) return null;
    const suggestions = field === "to" ? toSuggestions : field === "cc" ? ccSuggestions : bccSuggestions;
    if (suggestions.length === 0) return null;

    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border-subtle bg-bg-surface shadow-[var(--shadow-lg)] py-1 animate-fade-in">
        {suggestions.map((s, idx) => (
          <button
            key={s.email}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent blur before selection
              selectSuggestion(field, s.email, s.name);
            }}
            className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
              idx === focusedSuggestionIndex ? "bg-bg-raised text-text-primary" : "hover:bg-bg-raised/50 text-text-secondary"
            }`}
          >
            <div className="min-w-0 pr-2">
              <span className="font-semibold text-text-primary truncate block">
                {s.name || s.email.split("@")[0]}
              </span>
              <span className="text-[10px] text-text-tertiary truncate block font-mono">
                {s.email}
              </span>
            </div>
            {s.count > 2 && (
              <span className="shrink-0 text-[8.5px] bg-accent-primary/10 text-accent-primary font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                Frequent
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  const { data: dbUsername } = api.gmail.getUsername.useQuery(undefined, {
    enabled: isOpen,
  });

  // Inject signature if body is empty when username loads or panel opens
  useEffect(() => {
    if (isOpen && dbUsername && !body.trim()) {
      setBody(`\n\nBest regards,\n${dbUsername}`);
    }
  }, [isOpen, dbUsername, body]);

  // Right column AI copilot state
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [isReasoningEnabled, setIsReasoningEnabled] = useState(false);
  const [customInputMsgId, setCustomInputMsgId] = useState<string | null>(null);
  const [customInputVal, setCustomInputVal] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Get active session
  const { data: sessionData } = authClient.useSession();
  const userId = sessionData?.user?.id;

  // Toggle open on event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-compose", handleOpen);
    return () => window.removeEventListener("open-compose", handleOpen);
  }, []);

  // Keyboard shortcut listener ('c' / 'C')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      if ((e.key === "c" || e.key === "C") && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Set default welcome message on mount/userId
  useEffect(() => {
    setAiMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "I am your drafting co-pilot. Tell me what to write, or click a quick action to polish the draft in the editor.",
        timestamp: Date.now(),
      },
    ]);
  }, [userId]);

  // Auto-scroll AI feed
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages, scrollToBottom]);

  // tRPC Mutations
  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: "Email sent successfully!",
          timestamp: Date.now(),
        },
      ]);
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setTimeout(() => {
        setIsOpen(false);
        router.push("/inbox?tab=sent");
      }, 1500);
    },
    onError: (err) => {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: `Failed to send email: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    },
  });

  const createDraft = api.gmail.createDraft.useMutation({
    onSuccess: () => {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: "Draft saved successfully in Gmail drafts!",
          timestamp: Date.now(),
        },
      ]);
      router.push("/inbox?tab=drafts");
    },
    onError: (err) => {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: `Failed to save draft: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    },
  });

  const chat = api.agent.chat.useMutation({
    onSuccess: (data) => {
      const aiMsgId = crypto.randomUUID();
      setAiMessages((curr) => [
        ...curr,
        {
          id: aiMsgId,
          role: "assistant",
          text: data.text,
          reasoning: data.reasoning ?? undefined,
          timestamp: Date.now(),
        },
      ]);

      const parsed = parseDraftFromResponse(data.text);
      if (parsed.to) {
        setTo(parsed.to);
      }
      if (parsed.subject) {
        setSubject(parsed.subject);
      }
      if (parsed.cc) {
        setCc(parsed.cc);
      }
      if (parsed.bcc) {
        setBcc(parsed.bcc);
      }
      if (parsed.body) {
        setBody(parsed.body);
      }
    },
    onError: (err) => {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: `AI Assistant error: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    },
  });

  // Action Handlers
  const handleSend = () => {
    if (!to) {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: "Error: Recipient email is required to send.",
          timestamp: Date.now(),
        },
      ]);
      return;
    }
    sendEmail.mutate({
      to,
      subject: subject || "No Subject",
      body,
      cc: cc || undefined,
      bcc: bcc || undefined,
      fromEmail: fromEmail || undefined,
    });
  };

  const handleSaveDraft = () => {
    createDraft.mutate({
      to: to || undefined,
      subject,
      body,
      cc: cc || undefined,
      bcc: bcc || undefined,
      fromEmail: fromEmail || undefined,
    });
  };

  const submitAiMessage = (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || chat.isPending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      timestamp: Date.now(),
    };

    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");

    // Package request with the current state of the editor for absolute context
    const fullMessage = `Current Draft State:
To: ${to}
Cc: ${cc}
Bcc: ${bcc}
Subject: ${subject}
Body:
${body}

User Request: ${trimmed}

If you are proposing an email draft, you MUST format the draft fields inside a special block at the very end of your response, starting with "---DRAFT_START---" and ending with "---DRAFT_END---".
Put any conversational text, explanations, or follow-up questions outside of this block (preferably before it).

Example:
Conversational message or follow-up questions go here.

---DRAFT_START---
To: <to address, if any>
Subject: <email subject>
Cc: <cc address, if any>
Bcc: <bcc address, if any>
Body:
<email body>
---DRAFT_END---

If you are only asking a question or cannot draft the email yet, do NOT output the "---DRAFT_START---" and "---DRAFT_END---" block.`;

    chat.mutate({
      message: fullMessage,
      history: updated.map((m) => ({
        role: m.role,
        content: m.text,
        reasoning: m.reasoning,
      })),
      context: {
        route: pathname,
        targetEmail: fromEmail || undefined,
      },
      reasoningEnabled: isReasoningEnabled,
    });
  };

  const handleChatSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitAiMessage(aiInput);
  };

  const handleQuickAction = (action: string) => {
    if (action === "draft") {
      setAiInput("Draft an email to ");
      chatInputRef.current?.focus();
      return;
    }

    if (!body) {
      setAiMessages((curr) => [
        ...curr,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: "Please write or generate some text in the body first before running rewrite tools.",
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    let prompt = "";
    if (action === "improve") {
      prompt = "Improve the writing style, tone, and professionalism of the draft email.";
    } else if (action === "shorten") {
      prompt = "Make this email draft shorter and more concise, keeping it professional.";
    } else if (action === "polite") {
      prompt = "Rewrite the email draft to be more polite, friendly, and courteous.";
    }

    submitAiMessage(prompt);
  };

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex justify-end bg-black/20">
      {/* Backdrop dismiss */}
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close compose panel backdrop"
        onClick={() => setIsOpen(false)}
      />

      <aside className="border-border-default bg-bg-raised animate-slide-right flex h-full w-full max-w-[840px] border-l shadow-[var(--shadow-xl)] overflow-hidden">
        {/* ─── Left Column: Manual Editor ─── */}
        <section className="w-1/2 flex flex-col border-r border-border-subtle p-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Co-Pilot Compose</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-tertiary hover:bg-bg-surface hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors cursor-pointer"
              aria-label="Close compose panel"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            {/* From Selector */}
            {gmailStatus?.accounts && gmailStatus.accounts.length > 0 && (
              <div className="flex flex-col gap-1 animate-fade-in">
                <label htmlFor="from-select" className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">From</label>
                <select
                  id="from-select"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full border border-border-default bg-bg-inset text-text-primary focus:border-accent-primary outline-none px-3 py-2 text-sm rounded-[var(--radius-md)] transition-colors cursor-pointer"
                >
                  {gmailStatus.accounts.map((acc) => (
                    <option key={acc.id} value={acc.emailAddress} className="bg-bg-raised text-text-primary">
                      {acc.emailAddress}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="to-input" className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">To</label>
              <div className="relative">
                <input
                  id="to-input"
                  type="text"
                  value={to}
                  onChange={(e) => handleInputChange("to", e.target.value)}
                  onBlur={() => setTimeout(() => {
                    setActiveSuggestionField(null);
                  }, 200)}
                  onKeyDown={(e) => handleInputKeyDown("to", e)}
                  placeholder="recipient@example.com, friend@example.com"
                  className="w-full border border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-2 text-sm rounded-[var(--radius-md)] transition-colors"
                />
                {renderSuggestions("to")}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="cc-input" className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Cc</label>
              <div className="relative">
                <input
                  id="cc-input"
                  type="text"
                  value={cc}
                  onChange={(e) => handleInputChange("cc", e.target.value)}
                  onBlur={() => setTimeout(() => {
                    setActiveSuggestionField(null);
                  }, 200)}
                  onKeyDown={(e) => handleInputKeyDown("cc", e)}
                  placeholder="cc@example.com"
                  className="w-full border border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-2 text-sm rounded-[var(--radius-md)] transition-colors"
                />
                {renderSuggestions("cc")}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bcc-input" className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Bcc</label>
              <div className="relative">
                <input
                  id="bcc-input"
                  type="text"
                  value={bcc}
                  onChange={(e) => handleInputChange("bcc", e.target.value)}
                  onBlur={() => setTimeout(() => {
                    setActiveSuggestionField(null);
                  }, 200)}
                  onKeyDown={(e) => handleInputKeyDown("bcc", e)}
                  placeholder="bcc@example.com"
                  className="w-full border border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-2 text-sm rounded-[var(--radius-md)] transition-colors"
                />
                {renderSuggestions("bcc")}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="subject-input" className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Subject</label>
              <input
                id="subject-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="border border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-2 text-sm rounded-[var(--radius-md)] transition-colors"
              />
            </div>

            <div className="flex-1 flex flex-col gap-1 min-h-[220px]">
              <label htmlFor="body-input" className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Body</label>
              <textarea
                id="body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email here..."
                className="flex-1 resize-none border border-border-default bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-2.5 text-sm rounded-[var(--radius-md)] transition-colors"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 border-t border-border-subtle pt-4 mt-4">
            <Button
              onClick={handleSend}
              isLoading={sendEmail.isPending}
              className="flex-1 font-semibold uppercase tracking-wider text-xs h-10 cursor-pointer"
            >
              Send
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              isLoading={createDraft.isPending}
              className="flex-1 font-semibold uppercase tracking-wider text-xs h-10 cursor-pointer"
            >
              Save Draft
            </Button>
          </div>
        </section>

        {/* ─── Right Column: AI Assistant ─── */}
        <section className="w-1/2 flex flex-col bg-bg-base/40">
          {/* Header */}
          <div className="flex h-[53px] items-center border-b border-border-subtle px-4 gap-2.5">
            <div className="bg-accent-primary/10 text-accent-primary flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)]">
              <SparkIcon />
            </div>
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">AI Copilot</h3>
          </div>

          {/* AI Feed */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiMessages.map((message) => {
              const { cleanText, options } = parseOptionsAndCleanText(message.text);
              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-[var(--radius-md)] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                      message.role === "user"
                        ? "bg-accent-primary text-text-inverse border border-accent-primary"
                        : message.role === "system"
                          ? "bg-bg-inset text-text-secondary border border-border-subtle font-mono text-[11px]"
                          : "bg-bg-surface text-text-primary border border-border-subtle"
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
                                    submitAiMessage(customInputVal);
                                    setCustomInputMsgId(null);
                                    setCustomInputVal("");
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  submitAiMessage(customInputVal);
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
                                submitAiMessage(opt);
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

                  <span className="text-[9px] text-text-tertiary mt-0.5 px-1 font-mono">
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>
              );
            })}

            {chat.isPending && <ThinkingBar />}
          </div>

          {/* Actions & Input */}
          <div className="border-t border-border-subtle p-3 bg-bg-raised">
            {/* Quick Actions */}
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickAction("draft")}
                className="border border-border-default text-text-secondary hover:bg-bg-surface hover:text-text-primary rounded-full px-2.5 py-1 text-[10.5px] transition-colors cursor-pointer"
              >
                + Draft Email
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction("improve")}
                className="border border-border-default text-text-secondary hover:bg-bg-surface hover:text-text-primary rounded-full px-2.5 py-1 text-[10.5px] transition-colors cursor-pointer"
              >
                ⚡ Improve
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction("shorten")}
                className="border border-border-default text-text-secondary hover:bg-bg-surface hover:text-text-primary rounded-full px-2.5 py-1 text-[10.5px] transition-colors cursor-pointer"
              >
                ✂️ Shorten
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction("polite")}
                className="border border-border-default text-text-secondary hover:bg-bg-surface hover:text-text-primary rounded-full px-2.5 py-1 text-[10.5px] transition-colors cursor-pointer"
              >
                🌸 Polite
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleChatSubmit} className="flex flex-col gap-2 rounded-xl border border-transparent bg-bg-surface p-2 shadow-sm focus-within:shadow-md transition-all focus-within:bg-bg-base">
              <textarea
                ref={chatInputRef}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitAiMessage(aiInput);
                  }
                }}
                rows={2}
                placeholder="Ask AI to write, rewrite, or polish your email..."
                className="bg-transparent text-text-primary placeholder:text-text-tertiary w-full resize-none px-2 py-1 text-xs outline-none border-none focus:ring-0"
              />
              <div className="flex items-center justify-between px-1 border-t border-border-subtle/50 pt-2">
                {/* Deepthink Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReasoningEnabled(!isReasoningEnabled)}
                    title="Use Flash model for fast response and Pro model for more in depth response"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer ${
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
                  <span className="text-[10px] text-text-tertiary hidden sm:inline-block leading-none">
                    {isReasoningEnabled 
                      ? "Pro model: in-depth response" 
                      : "Flash model: fast response"}
                  </span>
                </div>

                <Button
                  type="submit"
                  isLoading={chat.isPending}
                  size="sm"
                  className="font-semibold px-4 py-1.5 text-xs"
                >
                  Send
                </Button>
              </div>
            </form>
          </div>
        </section>
      </aside>
    </div>
  );
}
