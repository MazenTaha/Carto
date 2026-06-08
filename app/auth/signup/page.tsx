'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signUpSchema } from '@/lib/validations';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/ui/Logo';

type SignUpFieldErrors = {
  name?: string;
  email?: string;
  password?: string;
};

function getSafeCallbackUrl(rawValue: string | null | undefined, fallback = '/dashboard') {
  if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) {
    return fallback;
  }

  return rawValue;
}

function readApiErrorMessage(payload: any, fallback: string) {
  if (typeof payload?.error?.message === 'string') return payload.error.message;
  if (typeof payload?.error === 'string') return payload.error;
  return fallback;
}

function readAuthErrorMessage(rawError: string | null | undefined) {
  if (!rawError || rawError === 'CredentialsSignin') {
    return 'Could not sign you in automatically. Please sign in with your new account.';
  }

  return rawError;
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    try {
      const validation = signUpSchema.safeParse({ email, password, name });

      if (!validation.success) {
        const nextFieldErrors: SignUpFieldErrors = {};

        for (const issue of validation.error.issues) {
          if (issue.path[0] === 'name' && !nextFieldErrors.name) {
            nextFieldErrors.name = issue.message;
          }
          if (issue.path[0] === 'email' && !nextFieldErrors.email) {
            nextFieldErrors.email = issue.message;
          }
          if (issue.path[0] === 'password' && !nextFieldErrors.password) {
            nextFieldErrors.password = issue.message;
          }
        }

        setFieldErrors(nextFieldErrors);
        setError('Please fix the highlighted fields and try again.');
        return;
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(readApiErrorMessage(data, 'Failed to create account'));
      }

      const result = await signIn('credentials', {
        email: validation.data.email,
        password: validation.data.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        router.push(`/auth/signin?registered=true&callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setError(readAuthErrorMessage(err?.message) || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    await signIn('google', { callbackUrl });
  };

  return (
    <PageContainer className="max-w-md bg-white px-0 dark:bg-slate-950">
      <div className="flex w-full items-center justify-between bg-transparent p-4 pb-2">
        <Link href="/auth/signin" className="flex size-12 shrink-0 cursor-pointer items-center text-slate-900 dark:text-slate-100">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </Link>
        <div className="flex flex-1 justify-center pr-12">
          <Link href="/" aria-label="Go to home" className="flex items-center">
            <Logo width={92} height={34} className="transition-opacity hover:opacity-80" />
          </Link>
        </div>
      </div>

      <div className="w-full px-6 pb-8 pt-12">
        <h1 className="text-left text-[32px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">Create Account</h1>
        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">Join Carto and simplify your shopping experience.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 px-6">
        <label className="flex w-full flex-col">
          <p className="pb-2 text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">Full Name</p>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">person</span>
            <input
              className={`flex h-14 w-full rounded-xl border bg-white pl-11 pr-4 text-base font-normal leading-normal text-slate-900 transition-all placeholder:text-slate-400 focus:outline-0 focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:text-slate-100 ${
                fieldErrors.name
                  ? 'border-red-300 focus:ring-red-100 dark:border-red-500/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder="Alex Johnson"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }
              }}
            />
          </div>
          {fieldErrors.name && (
            <p className="mt-2 text-sm text-red-500">{fieldErrors.name}</p>
          )}
        </label>

        <label className="flex w-full flex-col">
          <p className="pb-2 text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">Email Address</p>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">mail</span>
            <input
              className={`flex h-14 w-full rounded-xl border bg-white pl-11 pr-4 text-base font-normal leading-normal text-slate-900 transition-all placeholder:text-slate-400 focus:outline-0 focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:text-slate-100 ${
                fieldErrors.email
                  ? 'border-red-300 focus:ring-red-100 dark:border-red-500/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }
              }}
              required
            />
          </div>
          {fieldErrors.email && (
            <p className="mt-2 text-sm text-red-500">{fieldErrors.email}</p>
          )}
        </label>

        <label className="flex w-full flex-col">
          <p className="pb-2 text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">Password</p>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
            <input
              className={`flex h-14 w-full rounded-xl border bg-white pl-11 pr-12 text-base font-normal leading-normal text-slate-900 transition-all placeholder:text-slate-400 focus:outline-0 focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:text-slate-100 ${
                fieldErrors.password
                  ? 'border-red-300 focus:ring-red-100 dark:border-red-500/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder="Create a password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }
              }}
              required
            />
            <button
              type="button"
              className="absolute right-4 flex cursor-pointer items-center justify-center text-slate-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-2 text-sm text-red-500">{fieldErrors.password}</p>
          )}
        </label>

        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-primary px-5 text-base font-bold leading-normal tracking-[0.015em] text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <span className="truncate">{isLoading ? 'Creating...' : 'Sign Up'}</span>
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white px-5 text-base font-semibold leading-normal text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="truncate">{isGoogleLoading ? 'Opening...' : 'Continue with Google'}</span>
          </button>
        </div>
      </form>

      <div className="mt-auto w-full px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Already have an account?
          <Link className="ml-1 font-bold text-primary hover:underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
            Sign In
          </Link>
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20" />
    </PageContainer>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  );
}
