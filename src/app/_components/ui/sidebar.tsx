'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Tooltip } from '@/app/_components/ui/tooltip';
import { Avatar } from '@/app/_components/ui/avatar';
import { useTheme } from '@/app/_components/theme-provider';
import { api } from '@/trpc/react';
import { authClient } from '@/server/better-auth/client';

interface NavItem {
  label: string;
  href: string;
  shortcut?: string;
  icon: React.ReactNode;
}


const navItems: NavItem[] = [
  {
    label: 'Inbox',
    href: '/inbox',
    shortcut: 'G I',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
      </svg>
    ),
  },
  {
    label: 'Calendar',
    href: '/calendar',
    shortcut: 'G C',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: 'Agent Chat',
    href: '/agent',
    shortcut: 'G A',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.25 8.25 18 9.25l-.25-1a2 2 0 0 0-1.25-1.25l-1-.25 1-.25a2 2 0 0 0 1.25-1.25l.25-1 .25 1a2 2 0 0 0 1.25 1.25l1 .25-1 .25a2 2 0 0 0-1.25 1.25ZM17.5 20l-.5 1.75L16.5 20a2.5 2.5 0 0 0-1.75-1.75L13 17.75l1.75-.5A2.5 2.5 0 0 0 16.5 15.5l.5-1.75.5 1.75a2.5 2.5 0 0 0 1.75 1.75l1.75.5-1.75.5A2.5 2.5 0 0 0 17.5 20Z" />
      </svg>
    ),
  },
];

// ─── Keyboard Shortcuts Modal ─────────────────────────────────────────────────

const shortcuts = [
  { key: 'C', description: 'Compose new email' },
  { key: 'G I', description: 'Go to Inbox' },
  { key: 'G C', description: 'Go to Calendar' },
  { key: 'G A', description: 'Go to Agent Chat' },
  { key: 'G S', description: 'Go to Settings' },
  { key: 'E', description: 'Archive selected thread (in inbox)' },
  { key: '#', description: 'Delete selected thread (in inbox)' },
  { key: 'R', description: 'Open reply (in inbox)' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close panel / cancel' },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-border-default bg-bg-overlay shadow-[var(--shadow-xl)] animate-scale-in p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-text-primary">Keyboard Shortcuts</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Press <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-default rounded text-[10px] font-mono">?</kbd> to toggle this panel</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcut list */}
        <div className="flex flex-col gap-1">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
              <span className="text-sm text-text-secondary">{s.description}</span>
              <div className="flex gap-1">
                {s.key.split(' ').map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 bg-bg-surface border border-border-default rounded-md text-[11px] font-mono font-semibold text-text-primary shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Icon components ──────────────────────────────────────────────────────────

function ComposeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { data: sessionData } = authClient.useSession();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Fetch unread count for inbox badge
  const { data: threads } = api.gmail.listThreads.useQuery(
    { refresh: false },
    { refetchInterval: 60000 } // refresh every 60s
  );

  const unreadCount = threads
    ? threads.filter((t: any) => {
        const msgs = (t.data as any)?.messages ?? [];
        return msgs[0]?.labelIds?.includes('UNREAD');
      }).length
    : 0;

  // Global '?' keyboard shortcut to open shortcuts modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?') setShowShortcuts((prev) => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // G-prefix navigation shortcuts (G I, G C, G A, G S)
  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      // Don't trigger when typing in inputs
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      // Don't trigger with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'g' || e.key === 'G') {
        gPressed = true;
        // Reset after 1.5s if no second key pressed
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        switch (e.key.toLowerCase()) {
          case 'i': router.push('/inbox'); break;
          case 'c': router.push('/calendar'); break;
          case 'a': router.push('/agent'); break;
          case 's': router.push('/settings'); break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router]);

  return (
    <>
      <aside className="flex h-screen w-16 flex-col items-center border-r border-border-subtle bg-bg-raised py-4 sticky top-0">
        {/* ─── Logo ─── */}
        <Link
          href="/inbox"
          className="mb-4 flex h-9 w-9 overflow-hidden items-center justify-center rounded-[var(--radius-md)] bg-accent-primary text-text-inverse select-none transition-transform duration-150 hover:scale-105 active:scale-95"
          aria-label="Singularity home"
        >
          <img src="/logo.png" alt="Singularity Logo" className="h-full w-full object-cover" />
        </Link>

        <Tooltip content="Compose" shortcut="C" position="right">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-compose"))}
            className="mb-6 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-accent-primary text-text-inverse shadow-[var(--shadow-md)] transition-all duration-150 hover:bg-accent-primary-hover hover:shadow-[var(--shadow-glow)] hover:scale-105 active:scale-95"
            aria-label="Compose"
          >
            <ComposeIcon />
          </button>
        </Tooltip>

        {/* ─── Navigation ─── */}
        <nav className="flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const isInbox = item.href === '/inbox';
            return (
              <Tooltip key={item.href} content={item.label} shortcut={item.shortcut} position="right">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-all duration-150 ${
                    isActive
                      ? 'bg-accent-primary/15 text-accent-primary'
                      : 'text-text-tertiary hover:bg-bg-surface hover:text-text-secondary'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent-primary animate-scale-in" />
                  )}
                  {item.icon}
                  {/* Unread count badge for inbox */}
                  {isInbox && unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-primary text-[9px] font-bold text-text-inverse px-0.5 shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        {/* ─── Spacer ─── */}
        <div className="flex-1" />

        {/* ─── Bottom section ─── */}
        <div className="flex flex-col items-center gap-1">
          {/* Help / Keyboard Shortcuts */}
          <Tooltip content="Keyboard shortcuts" shortcut="?" position="right">
            <button
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard shortcuts"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-text-tertiary transition-all duration-150 hover:bg-bg-surface hover:text-text-secondary cursor-pointer"
            >
              <HelpIcon />
            </button>
          </Tooltip>

          {/* Settings */}
          <Tooltip content="Settings" shortcut="G S" position="right">
            <Link
              href="/settings"
              aria-label="Settings"
              className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-all duration-150 ${
                pathname.startsWith('/settings')
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-text-tertiary hover:bg-bg-surface hover:text-text-secondary'
              }`}
            >
              <SettingsIcon />
            </Link>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip content={theme === 'dark' ? 'Light mode' : 'Dark mode'} position="right">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-text-tertiary transition-all duration-150 hover:bg-bg-surface hover:text-text-secondary"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </Tooltip>

          {/* User avatar */}
          <Tooltip content="Settings" position="right">
            <Link
              href="/settings"
              aria-label="Settings"
              className="mt-1 flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              <Avatar name={sessionData?.user?.name ?? 'User'} size="sm" />
            </Link>
          </Tooltip>
        </div>
      </aside>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
