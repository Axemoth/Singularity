'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  shortcutHint?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, shortcutHint, value, className = '', ...props }, ref) => {
    return (
      <div className={`relative flex items-center ${className}`}>
        {/* Search icon */}
        <svg
          className="absolute left-3 h-4 w-4 text-text-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>

        <input
          ref={ref}
          type="text"
          value={value}
          className="w-full rounded-[var(--radius-md)] border border-border-default bg-bg-surface py-2 pl-9 pr-16 text-sm text-text-primary placeholder-text-tertiary transition-colors duration-[var(--transition-fast)] focus:border-accent-primary focus:bg-bg-raised focus:outline-none"
          {...props}
        />

        {/* Clear button */}
        {value && onClear && (
          <button
            onClick={onClear}
            className="absolute right-10 rounded p-0.5 text-text-tertiary hover:text-text-primary"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Shortcut hint */}
        {shortcutHint && !value && (
          <kbd className="absolute right-3 rounded-[var(--radius-sm)] bg-bg-inset px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
            {shortcutHint}
          </kbd>
        )}
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
