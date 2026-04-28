'use client';

import { useState } from 'react';
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

      router.push('/auth/signin?registered=true');
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
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <span className="truncate">{isLoading ? "Creating..." : "Sign Up"}</span>
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
