'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  shortcutHint?: string;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-accent-primary text-white hover:bg-accent-primary-hover shadow-[var(--shadow-sm)]',
  secondary:
    'bg-bg-surface text-text-primary hover:bg-bg-overlay border border-border-default',
  ghost: 'text-text-secondary hover:bg-bg-surface hover:text-text-primary',
  danger:
    'bg-accent-danger text-white hover:opacity-90 shadow-[var(--shadow-sm)]',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-[var(--radius-sm)]',
  md: 'px-4 py-2 text-sm rounded-[var(--radius-md)]',
  lg: 'px-6 py-2.5 text-base rounded-[var(--radius-md)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      shortcutHint,
      children,
      disabled,
      className = '',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-[var(--transition-fast)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
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
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        )}
        {children}
        {shortcutHint && (
          <kbd className="ml-1 hidden rounded-[var(--radius-sm)] bg-bg-inset px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary sm:inline-block">
            {shortcutHint}
          </kbd>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
