'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState('');
  const [avatar, setAvatar] = useState<string>('');

  useEffect(() => {
    setNotes(window.localStorage.getItem('carto_profile_notes') || '');
    setAvatar(window.localStorage.getItem('carto_profile_avatar') || '');
  }, []);

  const saveNotes = (value: string) => {
    setNotes(value);
    window.localStorage.setItem('carto_profile_notes', value);
  };

  const handleAvatarChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      setAvatar(value);
      window.localStorage.setItem('carto_profile_avatar', value);
    };
    reader.readAsDataURL(file);
  };

  const displayName = session?.user?.name || session?.user?.email || 'Guest Shopper';
  const initials = displayName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <PageContainer maxWidth="lg">
      <Header title="Profile" showBack />

      <main className="grid flex-1 gap-6 pb-32 pt-6 md:grid-cols-[340px_1fr] md:pb-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-3xl font-black text-primary ring-4 ring-primary/10">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  initials || <span className="material-symbols-outlined text-5xl">person</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform active:scale-95">
                <span className="material-symbols-outlined text-xl">photo_camera</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                />
              </label>
            </div>
            <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">{displayName}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your Carto profile, shopping notes, and personal reminders.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Personal notes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Use this for preferences, reminders, or store notes.</p>
            </div>
            <span className="material-symbols-outlined text-primary">edit_note</span>
          </div>
          <label className="sr-only" htmlFor="profile-notes">
            Personal notes
          </label>
          <textarea
            id="profile-notes"
            value={notes}
            onChange={(event) => saveNotes(event.target.value)}
            placeholder="Example: Avoid plastic bags, preferred milk brand, checkout reminders..."
            className="min-h-40 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
          <p className="mt-2 text-xs text-slate-400">Notes are saved locally on this device.</p>
        </section>
      </main>

      <BottomNav />
    </PageContainer>
  );
}
