import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  let session = null;
  
  // Check for guest mode first (before any imports that might fail)
  const cookieStore = await cookies();
  const guestModeCookie = cookieStore.get('guest_mode');
  const isGuestMode = guestModeCookie?.value === 'true';
  
  // Only try to get session if not in guest mode and env vars are set
  if (!isGuestMode && process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL) {
    try {
      // Lazy import to avoid loading if not needed
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth-config');
      session = await getServerSession(authOptions);
    } catch (error) {
      // Silently continue - guest mode will be checked
    }
  }

  if (session || isGuestMode) {
    redirect('/dashboard');
  } else {
    redirect('/auth/signin');
  }
}

