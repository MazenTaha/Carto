'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInSchema } from '@/lib/validations';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/ui/Logo';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      signInSchema.parse({ email, password });
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    setError('');
    try {
      const bypassResponse = await fetch('/api/auth/guest-bypass');
      if (bypassResponse.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        throw new Error('Failed to enable guest mode');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <PageContainer className="max-w-md bg-white px-0 dark:bg-slate-950">
      <div className="flex w-full items-center bg-transparent p-4 pb-2 justify-between">
        <Link href="/" className="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer">
          <span className="material-symbols-outlined text-2xl">close</span>
        </Link>
        <div className="flex-1 flex justify-center pr-12">
          <Link href="/" aria-label="Go to home" className="flex items-center">
            <Logo width={92} height={34} className="hover:opacity-80 transition-opacity" />
          </Link>
        </div>
      </div>

      <div className="w-full px-6 pt-12 pb-8">
        <h1 className="text-slate-900 dark:text-slate-100 tracking-tight text-[32px] font-bold leading-tight text-left">Welcome back</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base">Sign in to access your saved lists and history.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 px-6">
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
          <div className="flex justify-between items-center pb-2">
            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-normal">Password</p>
            <Link className="text-primary text-sm font-semibold hover:underline" href="#">Forgot?</Link>
          </div>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
            <input
              className="flex w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/20 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 pl-11 pr-12 text-base font-normal leading-normal transition-all"
              placeholder="Enter your password"
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
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <span className="truncate">{isLoading ? "Signing In..." : "Sign In"}</span>
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 border-2 border-slate-200 dark:border-slate-800 bg-transparent text-slate-700 dark:text-slate-300 text-base font-semibold leading-normal hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all disabled:opacity-50"
          >
            <span className="truncate">Continue as Guest</span>
          </button>
        </div>
      </form>

      <div className="w-full px-6 py-8 flex items-center gap-4">
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">or continue with</span>
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
      </div>

      <div className="w-full flex gap-4 px-6">
        <button className="flex-1 flex items-center justify-center h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
        </button>
        <button className="flex-1 flex items-center justify-center h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg className="w-5 h-5 fill-slate-900 dark:fill-white" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"></path>
          </svg>
        </button>
      </div>

      <div className="w-full mt-auto px-6 py-10 text-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Don&apos;t have an account?
          <Link className="text-primary font-bold ml-1 hover:underline" href="/auth/signup">Sign Up</Link>
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>
    </PageContainer>
  );
}
