// Checkout success page

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-config';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cookies } from 'next/headers';

export default async function CheckoutSuccessPage() {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const isGuestMode = cookieStore.get('guest_mode')?.value === 'true';

  if (!session && !isGuestMode) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex items-center justify-center p-8">
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-[2.5rem] border border-gray-700/50 shadow-2xl p-12 max-w-lg w-full text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/20 relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-20" />
              <svg
                className="w-12 h-12 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white tracking-tight mb-4">
            Order Confirmed!
          </h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Payment successful. Your smart cart has been unlocked and your digital receipt is now available in your history.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Link href="/dashboard">
              <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                DASHBOARD
              </button>
            </Link>
            <Link href="/lists">
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold rounded-2xl border border-gray-700/50 transition-all">
                MY LISTS
              </button>
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-700/50">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Receipt ID: #R-{Math.random().toString(36).substring(2, 9).toUpperCase()}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

