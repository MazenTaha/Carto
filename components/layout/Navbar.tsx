// Navigation bar component

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isGuestMode, setIsGuestMode] = useState(false);

  useEffect(() => {
    // Check for guest mode cookie
    if (typeof document !== 'undefined') {
      const guestCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('guest_mode='));
      setIsGuestMode(guestCookie?.split('=')[1] === 'true');
    }
  }, []);

  const handleSignOut = () => {
    // Clear guest mode cookie
    if (isGuestMode && typeof document !== 'undefined') {
      document.cookie = 'guest_mode=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    if (session) {
      signOut({ callbackUrl: '/auth/signin' });
    } else {
      router.push('/auth/signin');
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              Carto
            </Link>
            {(session || isGuestMode) && (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/lists" className="text-gray-700 hover:text-gray-900">
                  My Lists
                </Link>
                <Link href="/session" className="text-gray-700 hover:text-gray-900">
                  Active Session
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {(session || isGuestMode) ? (
              <>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">
                    {session?.user?.name || session?.user?.email || 'Guest User'}
                  </span>
                  {(isGuestMode || session?.user?.email === 'guest@carto.local') && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                      Guest Mode
                    </span>
                  )}
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

