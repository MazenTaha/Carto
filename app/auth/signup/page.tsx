'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUpSchema } from '@/lib/validations';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/ui/Logo';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      signUpSchema.parse({ email, password, name });
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create account');

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push('/auth/signin?registered=true');
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError('');
    setIsGuestLoading(true);

    try {
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign in as guest');
      }

      router.push(data.data?.redirectTo || '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    await signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <PageContainer className="max-w-md bg-white px-0 dark:bg-slate-950">
      <div className="flex w-full items-center bg-transparent p-4 pb-2 justify-between">
        <Link href="/auth/signin" className="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </Link>
        <div className="flex-1 flex justify-center pr-12">
          <Link href="/" aria-label="Go to home" className="flex items-center">
            <Logo width={92} height={34} className="hover:opacity-80 transition-opacity" />
          </Link>
        </div>
      </div>

      <div className="w-full px-6 pt-12 pb-8">
        <h1 className="text-slate-900 dark:text-slate-100 tracking-tight text-[32px] font-bold leading-tight text-left">Create Account</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">Join Carto and simplify your shopping experience.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 px-6">
        <label className="flex flex-col w-full">
          <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">Full Name</p>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">person</span>
            <input
              className="flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 pl-11 pr-4 text-base font-normal leading-normal transition-all"
              placeholder="Alex Johnson"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </label>

        <label className="flex flex-col w-full">
          <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">Email Address</p>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">mail</span>
            <input
              className="flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 pl-11 pr-4 text-base font-normal leading-normal transition-all"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </label>

        <label className="flex flex-col w-full">
          <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal pb-2">Password</p>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
            <input
              className="flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 pl-11 pr-12 text-base font-normal leading-normal transition-all"
              placeholder="Create a password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-4 text-slate-400 cursor-pointer flex items-center justify-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </label>

        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading || isGuestLoading || isGoogleLoading}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <span className="truncate">{isLoading ? "Creating..." : "Sign Up"}</span>
          </button>
          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={isLoading || isGuestLoading || isGoogleLoading}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 border-2 border-slate-200 dark:border-slate-800 bg-transparent text-slate-700 dark:text-slate-300 text-base font-semibold leading-normal hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all disabled:opacity-50"
          >
            <span className="truncate">{isGuestLoading ? 'Signing In...' : 'Continue as Guest'}</span>
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGuestLoading || isGoogleLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl h-14 px-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 text-base font-semibold leading-normal hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            <span className="truncate">{isGoogleLoading ? 'Opening...' : 'Continue with Google'}</span>
          </button>
        </div>
      </form>

      <div className="w-full mt-auto px-6 py-10 text-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Already have an account?
          <Link className="text-primary font-bold ml-1 hover:underline" href="/auth/signin">Sign In</Link>
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>
    </PageContainer>
  );
}
