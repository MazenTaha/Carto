'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { egyptianPhoneInputSchema, signInSchema } from '@/lib/validations';
import { getFirebaseClientAuth } from '@/lib/firebase/client';
import { ArrowRight, Lock, Mail, MonitorSmartphone, ShieldCheck, ShoppingBasket, Smartphone } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthDivider, GoogleIcon, PasswordToggle } from '@/components/auth/AuthControls';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { DemoAuthReadiness } from '@/types/auth-readiness';

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
  if (rawError === 'DATABASE_UNAVAILABLE') return 'This deployment cannot sign users in until its database is configured and reachable.';
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

function formatReadinessWarning(code: string) {
  switch (code) {
    case 'DATABASE_URL_MISSING':
      return 'DATABASE_URL is missing on the deployment.';
    case 'DATABASE_CONNECTION_FAILED':
      return 'The deployment cannot connect to its production database.';
    case 'DATABASE_SCHEMA_NOT_READY':
      return 'The production database schema is not ready yet. Run Prisma migrations.';
    case 'NEXTAUTH_URL_MISSING':
      return 'NEXTAUTH_URL is missing on the deployment.';
    case 'NEXTAUTH_URL_MISMATCH':
      return 'NEXTAUTH_URL does not match the deployed site origin.';
    case 'NEXTAUTH_SECRET_MISSING':
      return 'NEXTAUTH_SECRET is missing on the deployment.';
    case 'AUTH_SECRET_MISSING':
      return 'AUTH_SECRET is missing on the deployment.';
    case 'ADMIN_EMAILS_MISSING':
      return 'ADMIN_EMAILS is empty on the deployment.';
    case 'ADMIN_EMAIL_NOT_ALLOWED':
      return 'ADMIN_EMAILS does not include admin@gmail.com.';
    case 'ADMIN_USER_MISSING_IN_PRODUCTION_DB':
      return 'The admin user does not exist in the production database.';
    case 'ADMIN_PASSWORD_HASH_MISSING':
      return 'The admin user exists in production but is missing its password hash.';
    case 'GUEST_SESSION_TABLE_MISSING':
      return 'The GuestSession table is not reachable in production.';
    case 'GOOGLE_AUTH_NOT_CONFIGURED':
      return 'Google sign-in is not configured on the deployment.';
    case 'FIREBASE_CLIENT_CONFIG_MISSING':
      return 'The Firebase client env vars are missing on the deployment.';
    case 'FIREBASE_ADMIN_CONFIG_MISSING':
      return 'The Firebase admin env vars are missing on the deployment.';
    default:
      return code;
  }
}

function getCredentialsUnavailableMessage(readiness: DemoAuthReadiness | null) {
  if (!readiness) return 'Credentials sign-in is not available on this deployment yet.';
  if (!readiness.database.hasDatabaseUrl) return 'This deployment is missing DATABASE_URL, so email sign-in cannot work yet.';
  if (readiness.database.connection === 'error') {
    return readiness.database.prismaErrorMessageSafe
      ? `Database connection failed: ${readiness.database.prismaErrorMessageSafe}`
      : 'This deployment cannot reach its database or its schema is not ready yet.';
  }
  if (!readiness.auth.hasNextAuthUrl) return 'This deployment is missing NEXTAUTH_URL, so auth redirects may fail.';
  if (!readiness.auth.hasAnyAuthSecret) return 'This deployment is missing AUTH_SECRET and NEXTAUTH_SECRET, so auth sessions cannot work yet.';
  return 'Credentials sign-in is not available on this deployment yet.';
}

function getGuestUnavailableMessage(readiness: DemoAuthReadiness | null) {
  if (!readiness) return 'Guest mode is not available on this deployment yet.';
  if (!readiness.database.hasDatabaseUrl) return 'This deployment is missing DATABASE_URL, so guest mode cannot work yet.';
  if (readiness.database.connection === 'error') {
    return readiness.database.prismaErrorMessageSafe
      ? `Database connection failed: ${readiness.database.prismaErrorMessageSafe}`
      : 'This deployment cannot reach its database or its schema is not ready yet.';
  }
  return 'Guest mode is not available on this deployment yet.';
}

function getGoogleUnavailableMessage(readiness: DemoAuthReadiness | null) {
  if (!readiness) return 'Google sign-in is not configured on this deployment yet.';
  if (!readiness.auth.googleConfigured) return 'Google sign-in is disabled because GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.';
  if (readiness.database.connection !== 'ok') return getCredentialsUnavailableMessage(readiness);
  return 'Google sign-in is not configured on this deployment yet.';
}

function getPhoneUnavailableMessage(readiness: DemoAuthReadiness | null) {
  if (!readiness) return 'Phone sign-in is not configured on this deployment yet.';
  if (!readiness.auth.firebaseClientConfigured) return 'Phone sign-in is disabled because NEXT_PUBLIC_FIREBASE_* variables are missing.';
  if (!readiness.auth.firebaseAdminConfigured) return 'Phone sign-in is disabled because the server-side FIREBASE_* admin variables are missing.';
  if (readiness.database.connection !== 'ok') return getCredentialsUnavailableMessage(readiness);
  return 'Phone sign-in is not configured on this deployment yet.';
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
  const [notice, setNotice] = useState('');
  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
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
  const [authReadiness, setAuthReadiness] = useState<DemoAuthReadiness | null>(null);

  useEffect(() => {
    const queryError = searchParams.get('error');
    const registered = searchParams.get('registered');

    if (registered === 'true') {
      setNotice('Account created. Sign in to continue.');
      return;
    }

    if (queryError) {
      setError(readAuthErrorMessage(queryError));
    }
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;

    async function loadAuthReadiness() {
      try {
        const response = await fetch('/api/demo/auth-readiness', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const payload = await response.json().catch(() => null);

        if (!ignore && payload?.success === true) {
          setAuthReadiness(payload.data as DemoAuthReadiness);
        }
      } catch {}
    }

    void loadAuthReadiness();

    return () => {
      ignore = true;
    };
  }, []);

  const providers = authReadiness?.auth.providers;
  const credentialsEnabled = providers?.credentials ?? true;
  const guestEnabled = providers?.guest ?? true;
  const googleEnabled = providers?.google ?? true;
  const phoneEnabled = providers?.phone ?? true;
  const deploymentWarnings = authReadiness?.warnings ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!credentialsEnabled) {
      setError(getCredentialsUnavailableMessage(authReadiness));
      return;
    }

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
        setError(
          result.error === 'CredentialsSignin' && !credentialsEnabled
            ? getCredentialsUnavailableMessage(authReadiness)
            : readAuthErrorMessage(result.error)
        );
      } else {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      setError(readAuthErrorMessage(err?.message) || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    if (!googleEnabled) {
      setError(getGoogleUnavailableMessage(authReadiness));
      return;
    }
    setIsGoogleLoading(true);
    await signIn('google', { callbackUrl });
  };

  const handleContinueAsGuest = async () => {
    setError('');
    if (!guestEnabled) {
      setError(getGuestUnavailableMessage(authReadiness));
      return;
    }
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
      if (!phoneEnabled) {
        setError(getPhoneUnavailableMessage(authReadiness));
        return;
      }

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

  const isAnyLoading = isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading;

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to pick up your saved lists, live cart sessions and receipts."
      footer={
        <div className="space-y-4">
          <p>
            New to Carto?{' '}
            <Link className="font-semibold text-primary hover:underline" href={`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
              Create an account
            </Link>
          </p>
          <nav aria-label="Demo tools" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <span className="text-ink-subtle/80">Demo tools:</span>
            <Link href="/admin" className="inline-flex items-center gap-1.5 font-medium text-ink-muted hover:text-ink">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Admin dashboard
            </Link>
            <Link href="/device-simulator" className="inline-flex items-center gap-1.5 font-medium text-ink-muted hover:text-ink">
              <MonitorSmartphone className="size-3.5" aria-hidden="true" />
              Device simulator
            </Link>
          </nav>
        </div>
      }
    >
      {deploymentWarnings.length > 0 && (
        <Alert tone="warning" title="Deployment auth setup needs attention" className="mb-6">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {deploymentWarnings.slice(0, 4).map((warning) => (
              <li key={warning}>{formatReadinessWarning(warning)}</li>
            ))}
          </ul>
        </Alert>
      )}

      {notice && (
        <Alert tone="success" className="mb-5">
          {notice}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          leading={<Mail aria-hidden="true" />}
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) {
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }
          }}
          required
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          leading={<Lock aria-hidden="true" />}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          value={password}
          error={fieldErrors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) {
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }
          }}
          required
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={isAnyLoading || !credentialsEnabled}
        >
          {isLoading ? 'Signing in…' : credentialsEnabled ? 'Sign in' : 'Email sign-in unavailable'}
        </Button>
      </form>

      <AuthDivider>or continue with</AuthDivider>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          size="lg"
          onClick={handleGoogleSignIn}
          loading={isGoogleLoading}
          disabled={isAnyLoading || !googleEnabled}
        >
          {!isGoogleLoading && <GoogleIcon />}
          {isGoogleLoading ? 'Opening…' : 'Google'}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => setIsPhoneOpen((open) => !open)}
          aria-expanded={isPhoneOpen}
          aria-controls="phone-sign-in"
          disabled={isAnyLoading && !isPhoneOpen}
        >
          <Smartphone aria-hidden="true" />
          Phone number
        </Button>
      </div>

      <div id="phone-sign-in" hidden={!isPhoneOpen} className="mt-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs animate-rise-in">
          <p className="text-sm font-semibold text-ink">Sign in with an Egyptian mobile number</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {confirmationResult ? `We sent a code to ${phoneNumber}.` : 'We will text you a one-time verification code.'}
          </p>
          {!phoneEnabled && (
            <Alert tone="warning" className="mt-3">
              {getPhoneUnavailableMessage(authReadiness)}
            </Alert>
          )}
          <div className="mt-4 space-y-3">
            <Input
              label="Mobile number"
              placeholder="010xxxxxxxx"
              inputMode="tel"
              autoComplete="tel-national"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={Boolean(confirmationResult) || isPhoneLoading || !phoneEnabled}
            />
            {confirmationResult && (
              <Input
                label="Verification code"
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                disabled={isPhoneLoading}
              />
            )}
            <Button
              variant="secondary"
              fullWidth
              onClick={confirmationResult ? handleVerifyPhoneOtp : handleSendPhoneOtp}
              loading={isPhoneLoading}
              disabled={isLoading || isGoogleLoading || isGuestLoading || isPhoneLoading || !phoneEnabled}
            >
              {isPhoneLoading ? 'Checking…' : confirmationResult ? 'Verify code' : 'Send code'}
            </Button>
            {confirmationResult && (
              <button
                type="button"
                onClick={() => {
                  setConfirmationResult(null);
                  setOtpCode('');
                  clearRecaptcha();
                }}
                className="w-full text-center text-sm font-medium text-ink-muted hover:text-primary"
              >
                Use another number
              </button>
            )}
          </div>
          <div id="phone-recaptcha" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line-strong p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-primary">
            <ShoppingBasket className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Just browsing the store?</p>
            <p className="mt-0.5 text-sm text-ink-muted">Shop as a guest. Your lists stay on this device session.</p>
          </div>
        </div>
        <Button
          variant="ghost"
          fullWidth
          className="mt-3 border border-line bg-surface-muted text-ink hover:bg-surface-sunken"
          onClick={handleContinueAsGuest}
          loading={isGuestLoading}
          disabled={isAnyLoading || !guestEnabled}
        >
          {isGuestLoading ? 'Starting guest mode…' : 'Continue as guest'}
          {!isGuestLoading && <ArrowRight aria-hidden="true" />}
        </Button>
      </div>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
