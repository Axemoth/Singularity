"use client";

import React, { useState } from "react";

interface FormattedMessageProps {
  role: "user" | "assistant" | "system";
  text: string;
  reasoning?: string;
}

export function FormattedMessage({ role, text, reasoning }: FormattedMessageProps) {
  const [showThinking, setShowThinking] = useState(false);

  // If user or system message, render text directly (with markdown support for assistant/system)
  if (role === "user") {
    return <div className="whitespace-pre-wrap">{text}</div>;
  }

  // Parse inline <think> tags (common in DeepSeek models if reasoning is returned inline)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  const match = text.match(thinkRegex);

  let inlineThinking = "";
  let cleanText = text;
  if (match) {
    inlineThinking = match[1]?.trim() ?? "";
    cleanText = text.replace(thinkRegex, "").trim();
  }

  const thinkingText = reasoning || inlineThinking;

  return (
    <div className="space-y-2.5 w-full">
      {/* Collapsible Thinking Process Block */}
      {thinkingText && (
        <div className="border border-border-subtle bg-bg-raised/20 rounded-xl overflow-hidden max-w-full shadow-sm">
          <button
            type="button"
            onClick={() => setShowThinking(!showThinking)}
            className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-text-secondary hover:bg-bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-text-tertiary">
              <svg className="h-4 w-4 text-accent-primary animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0-.495-7.467 5.99 5.99 0 0 0 1.925 3.546 5.974 5.974 0 0 1 2.133-1A3.75 3.75 0 0 0 12 18Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 1 0-1.5 0v3.75a.75.75 0 1 0 1.5 0V6ZM12 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
              </svg>
              <span className="uppercase tracking-wider text-[10px] font-bold">Thinking Process</span>
            </div>
            <svg
              className={`h-4 w-4 text-text-tertiary transition-transform duration-250 ${
                showThinking ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          
          {showThinking && (
            <div className="border-t border-border-subtle/50 px-4 py-3 text-[11px] font-mono leading-relaxed text-text-tertiary whitespace-pre-wrap max-h-56 overflow-y-auto bg-bg-inset/30">
              {thinkingText}
            </div>
          )}
        </div>
      )}

      {/* Main Response Markdown */}
      <FormattedText text={cleanText} role={role} />
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
        <ul key={key} className="list-disc pl-5 my-2.5 space-y-1.5 text-text-primary text-[13px] leading-relaxed">
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
        <p key={`p-${blockIdx}-${i}`} className="text-text-primary text-[13px] leading-relaxed my-1.5">
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
