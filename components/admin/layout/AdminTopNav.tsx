'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const BREADCRUMB_MAP: Record<string, string> = {
  '/admin':            'Dashboard',
  '/admin/products':   'Products',
  '/admin/carts':      'Carts',
  '/admin/sessions':   'Sessions',
  '/admin/users':      'Users',
  '/admin/analytics':  'Analytics',
};

export function AdminTopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const breadcrumb = BREADCRUMB_MAP[pathname] ?? 'Admin';

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : session?.user?.email?.[0]?.toUpperCase() ?? 'A';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Carto</span>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-slate-800">{breadcrumb}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Live badge */}
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>

        {/* Notifications (static) */}
        <button className="relative rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* Avatar dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm hover:bg-slate-50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              {initials}
            </div>
            <span className="hidden max-w-[100px] truncate font-medium text-slate-700 sm:block">
              {session?.user?.name ?? session?.user?.email ?? 'Admin'}
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {session?.user?.name ?? 'Admin'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
                </div>
                <button
                  onClick={async () => {
                    await signOut({ redirect: false });
                    window.location.href = '/auth/signin';
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
