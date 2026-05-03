import { redirect } from 'next/navigation';
import { requireUserOrGuest } from '@/lib/guest-session';

export default async function Home() {
  const owner = process.env.DATABASE_URL ? await requireUserOrGuest() : null;

  if (owner) {
    redirect('/dashboard');
  } else {
    redirect('/auth/signin');
  }
}

