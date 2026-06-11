'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip } from '@/app/_components/ui/tooltip';
import { Avatar } from '@/app/_components/ui/avatar';
import { useTheme } from '@/app/_components/theme-provider';

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
];

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

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-border-subtle bg-bg-raised py-4 sticky top-0">
      {/* ─── Logo ─── */}
      <Link
        href="/inbox"
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-accent-primary text-white font-bold text-base select-none transition-transform duration-150 hover:scale-105 active:scale-95"
        aria-label="Singularity home"
      >
        S
      </Link>

      {/* ─── Compose ─── */}
      <Tooltip content="Compose" shortcut="C" position="right">
        <button
          className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary text-white shadow-[var(--shadow-md)] transition-all duration-150 hover:bg-accent-primary-hover hover:shadow-[var(--shadow-lg)] hover:scale-105 active:scale-95"
          aria-label="Compose"
        >
          <ComposeIcon />
        </button>
      </Tooltip>

      {/* ─── Navigation ─── */}
      <nav className="flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
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
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Bottom section ─── */}
      <div className="flex flex-col items-center gap-1">
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
        <Tooltip content="Account" position="right">
          <button
            aria-label="Account"
            className="mt-1 flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
          >
            <Avatar name="User" size="sm" />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
