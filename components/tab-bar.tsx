'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Saves', icon: '📥' },
  { href: '/ask', label: 'Ask', icon: '💬' },
  { href: '/council', label: 'Council', icon: '🏛️' },
  { href: '/topics', label: 'Topics', icon: '🧭' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function TabBar() {
  const path = usePathname();
  const active = (href: string) => (href === '/' ? path === '/' || path.startsWith('/items') : path.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => (
          <li key={tab.href} className="flex-1">
            <Link
              href={tab.href}
              aria-current={active(tab.href) ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active(tab.href) ? 'font-semibold text-accent' : 'text-muted'}`}
            >
              <span aria-hidden className="text-lg leading-none">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
