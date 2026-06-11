'use client';

import { useState, type ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}

const positionStyles = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({
  children,
  content,
  position = 'right',
  shortcut,
}: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 whitespace-nowrap rounded-[var(--radius-sm)] bg-bg-overlay px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-[var(--shadow-lg)] border border-border-default animate-fade-in ${positionStyles[position]}`}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="ml-2 rounded bg-bg-inset px-1 py-0.5 font-mono text-[10px] text-text-tertiary">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}
