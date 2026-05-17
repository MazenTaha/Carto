// Navigation bar component

'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export function Navbar() {
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = '/auth/signin';
  };

  return (
    <nav className="border-b border-warm-border/45 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center">
              <Logo width={100} height={35} className="hover:opacity-80 transition-opacity" />
            </Link>
            {session && (
              <>
                <Link href="/dashboard" className="text-slate-700 hover:text-primary">
                  Home
                </Link>
                <Link href="/dashboard" className="text-slate-700 hover:text-primary">
                  Dashboard
                </Link>
                <Link href="/lists" className="text-slate-700 hover:text-primary">
                  My Lists
                </Link>
                <Link href="/session" className="text-slate-700 hover:text-primary">
                  Active Session
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-700">
                    {session?.user?.name || session?.user?.email || 'Signed in'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/auth/signin">
                <Button variant="primary" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

