'use client';

import type { Priority } from '@/types/email';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'priority' | 'account';
  priority?: Priority;
  color?: string;
}

const priorityStyles: Record<Priority, string> = {
  urgent:
    'bg-accent-danger/15 text-accent-danger border-accent-danger/30',
  normal:
    'bg-accent-info/15 text-accent-info border-accent-info/30',
  low: 'bg-bg-surface text-text-tertiary border-border-subtle',
};

export function Badge({
  children,
  variant = 'default',
  priority,
  color,
}: BadgeProps) {
  if (variant === 'priority' && priority) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityStyles[priority]}`}
      >
        {children}
      </span>
    );
  }

  if (variant === 'account' && color) {
    return (
      <span
        className="inline-flex h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        title={String(children)}
      />
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
      {children}
    </span>
  );
}
