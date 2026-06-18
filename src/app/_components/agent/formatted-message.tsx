"use client";

import React, { useState } from "react";
import { api } from "@/trpc/react";

interface FormattedMessageProps {
  role: "user" | "assistant" | "system";
  text: string;
  reasoning?: string;
}

const parseDraftFromResponse = (text: string) => {
  const draftMatch = text.match(/---DRAFT_START---([\s\S]*?)---DRAFT_END---/i);
  if (!draftMatch) return null;

  const draftText = draftMatch[1] ?? "";
  const toMatch = draftText.match(/To:[ \t]*(.*)/i);
  const subjectMatch = draftText.match(/Subject:[ \t]*(.*)/i);
  const ccMatch = draftText.match(/Cc:[ \t]*(.*)/i);
  const bccMatch = draftText.match(/Bcc:[ \t]*(.*)/i);
  const bodyMatch = draftText.match(/Body:\s*([\s\S]*)$/i);

  let body = bodyMatch ? bodyMatch[1]?.trim() : "";
  if (body) {
    // Strip markdown code fences if wrapped
    body = body.replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "");
  }

  return {
    to: (toMatch ? toMatch[1]?.trim() : null) ?? "",
    subject: (subjectMatch ? subjectMatch[1]?.trim() : null) ?? "",
    cc: (ccMatch ? ccMatch[1]?.trim() : null) ?? "",
    bcc: (bccMatch ? bccMatch[1]?.trim() : null) ?? "",
    body: body ?? "",
  };
};

interface DraftData {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

function InteractiveDraftCard({ initialDraft }: { initialDraft: DraftData }) {
  const [to, setTo] = useState(initialDraft.to);
  const [cc, setCc] = useState(initialDraft.cc);
  const [bcc, setBcc] = useState(initialDraft.bcc);
  const [subject, setSubject] = useState(initialDraft.subject);
  const [body, setBody] = useState(initialDraft.body);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [showBcc, setShowBcc] = useState(!!initialDraft.bcc);

  const utils = api.useUtils();

  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: async () => {
      setStatus({ type: "success", message: "Email sent successfully!" });
      await utils.gmail.listThreads.invalidate();
    },
    onError: (err) => {
      setStatus({ type: "error", message: `Failed to send: ${err.message}` });
    },
  });

  const createDraft = api.gmail.createDraft.useMutation({
    onSuccess: () => {
      setStatus({ type: "success", message: "Draft saved successfully!" });
    },
    onError: (err) => {
      setStatus({ type: "error", message: `Failed to save draft: ${err.message}` });
    },
  });

  const handleSend = () => {
    if (!to) {
      setStatus({ type: "error", message: "Recipient email (To) is required." });
      return;
    }
    setStatus({ type: null, message: "" });
    sendEmail.mutate({
      to,
      subject: subject || "No Subject",
      body,
      cc: cc || undefined,
      bcc: bcc || undefined,
    });
  };

  const handleSave = () => {
    setStatus({ type: null, message: "" });
    createDraft.mutate({
      to: to || undefined,
      subject: subject || "No Subject",
      body,
      cc: cc || undefined,
      bcc: bcc || undefined,
    });
  };

  const isPending = sendEmail.isPending || createDraft.isPending;

  if (status.type === "success") {
    return (
      <div className="mt-4 border border-green-500/30 bg-green-500/10 text-green-400 p-4 rounded-xl text-xs flex flex-col gap-2 animate-fade-in w-full max-w-full">
        <div className="flex items-center gap-2 font-semibold">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {status.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border border-border-subtle bg-bg-raised rounded-xl p-4 shadow-sm flex flex-col gap-3 animate-fade-in w-full max-w-full text-[13px] text-text-primary">
      <div className="border-b border-border-subtle/50 pb-2 flex items-center justify-between">
        <span className="font-bold text-text-primary uppercase tracking-wider text-[10px]">Draft Review</span>
        <button
          type="button"
          onClick={() => setShowBcc(!showBcc)}
          className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {showBcc ? "- Hide BCC" : "+ Add BCC"}
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* To */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">To</label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={isPending}
            placeholder="recipient@example.com"
            className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
          />
        </div>

        {/* Cc & Bcc Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              disabled={isPending}
              placeholder="cc@example.com"
              className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
            />
          </div>
          {showBcc ? (
            <div className="flex flex-col gap-1 animate-fade-in">
              <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">BCC</label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                disabled={isPending}
                placeholder="bcc@example.com"
                className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
              />
            </div>
          ) : (
            <div />
          )}
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isPending}
            placeholder="Subject"
            className="w-full border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
          />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isPending}
            rows={5}
            placeholder="Email body..."
            className="w-full resize-none border border-border-subtle bg-bg-inset text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none px-3 py-2 text-xs rounded-lg transition-colors disabled:opacity-50 font-sans leading-relaxed"
          />
        </div>
      </div>

      {status.type === "error" && (
        <div className="text-[11px] text-red-400 font-semibold mt-1">
          {status.message}
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending}
          className="flex-1 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-text-inverse text-xs px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          {sendEmail.isPending ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-text-inverse border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
          Send Email
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 border border-border-default hover:bg-bg-surface disabled:opacity-50 text-text-secondary text-xs px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          {createDraft.isPending ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-text-secondary border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          Save Draft
        </button>
      </div>
    </div>
  );
}

export function FormattedMessage({ role, text }: FormattedMessageProps) {
  // If user or system message, render text directly (with markdown support for assistant/system)
  if (role === "user") {
    return <div className="whitespace-pre-wrap">{text}</div>;
  }

  // Parse inline <think> tags (common in DeepSeek models if reasoning is returned inline)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  const match = text.match(thinkRegex);

  let cleanText = text;
  if (match) {
    cleanText = text.replace(thinkRegex, "").trim();
  }

  const draftData = role === "assistant" ? parseDraftFromResponse(cleanText) : null;
  const displayCleanText = draftData 
    ? cleanText.replace(/---DRAFT_START---[\s\S]*?---DRAFT_END---/gi, "").trim()
    : cleanText;

  return (
    <div className="space-y-2.5 w-full">
      {/* Main Response Markdown */}
      <FormattedText text={displayCleanText} role={role} />

      {/* Interactive Draft Card */}
      {draftData && <InteractiveDraftCard initialDraft={draftData} />}
    </div>
  );
}

function FormattedText({ text, role }: { text: string; role: "assistant" | "system" }) {
  // First, split by code blocks
  const blocks = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-2.5 font-sans ${role === "system" ? "font-mono" : ""}`}>
      {blocks.map((block, idx) => {
        if (block.startsWith("```") && block.endsWith("```")) {
          const lines = block.slice(3, -3).trim().split("\n");
          const firstLine = lines[0] ?? "";
          const hasLang = firstLine && !firstLine.includes(" ") && firstLine.length < 15;
          const language = hasLang ? firstLine : "";
          const code = hasLang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={idx} className="my-3 border border-border-subtle rounded-xl overflow-hidden bg-bg-inset shadow-inner">
              {language && (
                <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider">
                  {language}
                </div>
              )}
              <pre className="p-4 overflow-x-auto font-mono text-xs text-text-secondary leading-normal">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        return renderMarkdownLines(block, idx);
      })}
    </div>
  );
}

function renderMarkdownLines(text: string, blockIdx: number) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="list-disc pl-5 my-2.5 space-y-1.5 text-text-primary text-[13px] leading-relaxed break-words">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith("### ")) {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(
        <h4 key={`h3-${blockIdx}-${i}`} className="text-text-primary text-sm font-semibold mt-4 mb-2 tracking-wide">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(
        <h3 key={`h2-${blockIdx}-${i}`} className="text-text-primary text-base font-bold mt-5 mb-2.5">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(
        <h2 key={`h1-${blockIdx}-${i}`} className="text-text-primary text-lg font-extrabold mt-6 mb-3 border-b border-border-subtle pb-1">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h2>
      );
    }
    // Blockquote
    else if (trimmed.startsWith("> ")) {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(
        <blockquote key={`quote-${blockIdx}-${i}`} className="border-l-[3px] border-accent-primary bg-bg-surface/50 px-4 py-2.5 my-3 rounded-r-xl italic text-text-secondary text-[12.5px] leading-relaxed shadow-sm">
          {renderInlineMarkdown(trimmed.slice(2))}
        </blockquote>
      );
    }
    // List Item
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = true;
      listItems.push(
        <li key={`li-${blockIdx}-${i}`}>
          {renderInlineMarkdown(trimmed.slice(2))}
        </li>
      );
    }
    // Numbered List Item
    else if (/^\d+\.\s/.test(trimmed)) {
      flushList(`list-${blockIdx}-${i}`);
      const match = trimmed.match(/^(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <div key={`ol-${blockIdx}-${i}`} className="flex items-start gap-2.5 my-1.5 text-text-primary text-[13px] leading-relaxed pl-1">
            <span className="font-bold text-accent-primary min-w-[15px] text-right">{match[1]}.</span>
            <span className="flex-1">{renderInlineMarkdown(match[2]!)}</span>
          </div>
        );
      }
    }
    // Divider
    else if (trimmed === "---" || trimmed === "***") {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(<hr key={`hr-${blockIdx}-${i}`} className="my-4 border-t border-border-subtle" />);
    }
    // Blank line
    else if (trimmed === "") {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(<div key={`space-${blockIdx}-${i}`} className="h-1.5" />);
    }
    // Standard paragraph
    else {
      flushList(`list-${blockIdx}-${i}`);
      elements.push(
        <p key={`p-${blockIdx}-${i}`} className="text-text-primary text-[13px] leading-relaxed my-1.5 break-words">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  }

  flushList(`list-end-${blockIdx}`);
  return <div key={`lines-container-${blockIdx}`} className="space-y-1">{elements}</div>;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|`.*?`|https?:\/\/\S+)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-bold text-text-primary">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className="bg-bg-inset border border-border-subtle rounded px-1.5 py-0.5 font-mono text-[11px] text-accent-primary">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a key={idx} href={part} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-semibold break-all">
          {part}
        </a>
      );
    }
    return part;
  });
}
