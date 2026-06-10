'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { egyptianPhoneInputSchema, signInSchema } from '@/lib/validations';
import { getFirebaseClientAuth } from '@/lib/firebase/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/ui/Logo';

type SignInFieldErrors = {
  email?: string;
  password?: string;
};

const GUEST_ALLOWED_CALLBACKS = ['/dashboard', '/lists', '/session', '/checkout'];

function getSafeCallbackUrl(rawValue: string | null | undefined, fallback = '/dashboard') {
  if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) {
    return fallback;
  }

  return rawValue;
}

function getGuestCallbackUrl(rawValue: string | null | undefined) {
  const callbackUrl = getSafeCallbackUrl(rawValue);
  const canGuestAccess = GUEST_ALLOWED_CALLBACKS.some((path) => (
    callbackUrl === path ||
    callbackUrl.startsWith(`${path}/`) ||
    callbackUrl.startsWith(`${path}?`)
  ));

  return canGuestAccess ? callbackUrl : '/dashboard';
}

function readApiErrorMessage(payload: any, fallback: string) {
  if (typeof payload?.error?.message === 'string') return payload.error.message;
  if (typeof payload?.error === 'string') return payload.error;
  return fallback;
}

function readAuthErrorMessage(rawError: string | null | undefined) {
  if (!rawError) return 'Invalid email or password';
  if (rawError === 'CredentialsSignin') return 'Invalid email or password';
  if (rawError === 'SessionRequired') return 'Please sign in to continue.';
  if (rawError === 'AccessDenied') return 'You do not have permission to open that page.';
  if (rawError === 'OAuthAccountNotLinked') return 'This email is already linked to another sign-in method.';

  try {
    const parsed = JSON.parse(rawError);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const firstMessage = parsed.find((issue) => typeof issue?.message === 'string')?.message;
      if (firstMessage) return firstMessage;
    }
  } catch {}

  return rawError;
}

function readFirebasePhoneError(error: any) {
  switch (error?.code) {
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'Enter a valid Egyptian mobile number.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Too many verification attempts. Please wait a little and try again.';
    case 'auth/code-expired':
      return 'That verification code expired. Request a new code and try again.';
    case 'auth/invalid-verification-code':
      return 'That verification code is not correct.';
    case 'auth/captcha-check-failed':
      return 'Phone verification could not confirm the reCAPTCHA challenge. Please try again.';
    case 'auth/configuration-not-found':
    case 'auth/app-not-authorized':
      return 'Phone login is not configured for this domain yet.';
    default:
      return error?.message || 'Could not complete phone verification.';
  }
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  const guestCallbackUrl = getGuestCallbackUrl(searchParams.get('callbackUrl'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const queryError = searchParams.get('error');
    const registered = searchParams.get('registered');

    if (registered === 'true') {
      setError('Account created. Sign in to continue.');
      return;
    }

    if (queryError) {
      setError(readAuthErrorMessage(queryError));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    try {
      const validation = signInSchema.safeParse({ email, password });

      if (!validation.success) {
        const nextFieldErrors: SignInFieldErrors = {};

        for (const issue of validation.error.issues) {
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

      const result = await signIn('credentials', {
        email: validation.data.email,
        password: validation.data.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(readAuthErrorMessage(result.error));
      } else {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      setError(readAuthErrorMessage(err?.message) || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminQuickAccess = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: 'admin@gmail.com',
        password: 'Admin_1',
        redirect: false,
        callbackUrl: '/admin',
      });

      if (result?.error) {
        setError(
          result.error === 'CredentialsSignin'
            ? 'Admin account not found or password incorrect. Try restarting the dev server.'
            : readAuthErrorMessage(result.error)
        );
      } else {
        router.push('/admin');
      }
    } catch (err) {
      console.error('Admin quick access error:', err);
      setError('An error occurred during admin quick access.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    await signIn('google', { callbackUrl });
  };

  const handleContinueAsGuest = async () => {
    setError('');
    setIsGuestLoading(true);

    try {
      const response = await fetch('/api/auth/guest', { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readApiErrorMessage(data, 'Could not start guest mode. Please try again.'));
      }

      router.push(guestCallbackUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not start guest mode. Please try again.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const getRecaptchaVerifier = (auth: ReturnType<typeof getFirebaseClientAuth>) => {
    if (!recaptchaVerifierRef.current) {
      throw new Error('Phone verification is not initialized yet.');
    }

    return recaptchaVerifierRef.current;
  };

  const clearRecaptcha = () => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
  };

  const handleSendPhoneOtp = async () => {
    setError('');
    setIsPhoneLoading(true);

    try {
      const parsed = egyptianPhoneInputSchema.safeParse({ phoneNumber });

      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message || 'Enter a valid Egyptian mobile number.');
        return;
      }

      const auth = getFirebaseClientAuth();
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');

      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'phone-recaptcha', {
          size: 'invisible',
        });
      }

      const verifier = getRecaptchaVerifier(auth);
      const result = await signInWithPhoneNumber(auth, parsed.data.phoneNumber, verifier);
      setConfirmationResult(result);
    } catch (err: any) {
      clearRecaptcha();
      setConfirmationResult(null);
      setError(readFirebasePhoneError(err));
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!confirmationResult) {
      setError('Request a verification code first.');
      return;
    }

    if (!otpCode.trim()) {
      setError('Enter the verification code that was sent to your phone.');
      return;
    }

    setError('');
    setIsPhoneLoading(true);

    try {
      const credential = await confirmationResult.confirm(otpCode.trim());
      const idToken = await credential.user.getIdToken();
      const verifyResponse = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const verifyData = await verifyResponse.json().catch(() => null);

      if (!verifyResponse.ok) {
        throw new Error(readApiErrorMessage(verifyData, 'Invalid phone verification.'));
      }

      const result = await signIn('phone-otp', {
        idToken,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        throw new Error(readAuthErrorMessage(result.error));
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setError(readFirebasePhoneError(err));
    } finally {
      setIsPhoneLoading(false);
    }
  };

  return (
    <PageContainer className="max-w-md bg-white px-0 dark:bg-slate-950">
      <div className="flex w-full items-center justify-between bg-transparent p-4 pb-2">
        <Link href="/" className="flex size-12 shrink-0 cursor-pointer items-center text-slate-900 dark:text-slate-100">
          <span className="material-symbols-outlined text-2xl">close</span>
        </Link>
        <div className="flex flex-1 justify-center pr-12">
          <Link href="/" aria-label="Go to home" className="flex items-center">
            <Logo width={92} height={34} className="transition-opacity hover:opacity-80" />
          </Link>
        </div>
      </div>

      <div className="w-full px-6 pb-8 pt-12">
        <h1 className="text-left text-[32px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">Welcome back</h1>
        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">Sign in to access your saved lists and history.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 px-6">
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
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium leading-normal text-slate-700 dark:text-slate-300">Password</p>
            <Link className="text-sm font-semibold text-primary hover:underline" href="#">
              Forgot?
            </Link>
          </div>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
            <input
              className={`flex h-14 w-full rounded-xl border bg-white pl-11 pr-12 text-base font-normal leading-normal text-slate-900 transition-all placeholder:text-slate-400 focus:outline-0 focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:text-slate-100 ${
                fieldErrors.password
                  ? 'border-red-300 focus:ring-red-100 dark:border-red-500/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
              placeholder="Enter your password"
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
            disabled={isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading}
            className="flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-primary px-5 text-base font-bold leading-normal tracking-[0.015em] text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <span className="truncate">{isLoading ? 'Signing In...' : 'Sign In'}</span>
          </button>
        </div>
      </form>

      <div className="flex w-full items-center gap-4 px-6 py-8">
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs font-medium uppercase tracking-widest text-slate-400">or continue with</span>
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="flex w-full gap-4 px-6">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {isGoogleLoading ? 'Opening...' : 'Google'}
        </button>
      </div>

      <div className="w-full px-6 pt-2">
        <button
          type="button"
          onClick={handleContinueAsGuest}
          disabled={isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading}
          className="group flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 py-4 text-emerald-700 transition-all hover:bg-emerald-100 hover:shadow-sm disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
        >
          <span className="material-symbols-outlined text-xl transition-transform group-hover:scale-110">shopping_bag</span>
          <span className="font-bold tracking-tight text-base">{isGuestLoading ? 'Starting guest mode...' : 'Continue as Guest'}</span>
        </button>
      </div>

      {process.env.NODE_ENV !== 'production' && (
        <div className="w-full px-6 pt-2">
          <button
            type="button"
            onClick={handleAdminQuickAccess}
            disabled={isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 py-4 text-indigo-700 transition-all hover:bg-indigo-100 hover:shadow-sm disabled:opacity-50 dark:border-indigo-900/30 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
          >
            <span className="material-symbols-outlined text-xl transition-transform group-hover:scale-110">admin_panel_settings</span>
            <span className="font-bold tracking-tight text-base">Admin Dashboard</span>
          </button>
        </div>
      )}

      <div className="w-full px-6 pt-2">
        <Link
          href="/device-simulator"
          className="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-4 text-slate-700 transition-all hover:bg-slate-100 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl transition-transform group-hover:scale-110">shopping_cart</span>
          <span className="font-bold tracking-tight text-base">Device Simulator</span>
        </Link>
      </div>

      <div className="w-full px-6 pt-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Egyptian mobile number</p>
          <div className="mt-3 flex flex-col gap-3">
            <input
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:ring-2 focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder="010xxxxxxxx"
              inputMode="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={Boolean(confirmationResult) || isPhoneLoading}
            />
            {confirmationResult && (
              <input
                className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:ring-2 focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Verification code"
                inputMode="numeric"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                disabled={isPhoneLoading}
              />
            )}
            <button
              type="button"
              onClick={confirmationResult ? handleVerifyPhoneOtp : handleSendPhoneOtp}
              disabled={isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading}
              className="flex h-12 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50 dark:bg-primary"
            >
              {isPhoneLoading ? 'Checking...' : confirmationResult ? 'Verify Code' : 'Send Code'}
            </button>
            {confirmationResult && (
              <button
                type="button"
                onClick={() => {
                  setConfirmationResult(null);
                  setOtpCode('');
                  clearRecaptcha();
                }}
                className="text-sm font-bold text-slate-500 hover:text-primary"
              >
                Use another number
              </button>
            )}
          </div>
          <div id="phone-recaptcha" />
        </div>
      </div>

      <div className="mt-auto w-full px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?
          <Link className="ml-1 font-bold text-primary hover:underline" href={`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
            Sign Up
          </Link>
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20" />
    </PageContainer>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
