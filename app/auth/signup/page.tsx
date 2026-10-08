'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signUpSchema } from '@/lib/validations';
import { Lock, Mail, UserRound } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthDivider, GoogleIcon, PasswordToggle } from '@/components/auth/AuthControls';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { DemoAuthReadiness } from '@/types/auth-readiness';

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

  if (rawError === 'DATABASE_UNAVAILABLE') {
    return 'This deployment cannot sign users in until its database is configured and reachable.';
  }

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

function getSignUpUnavailableMessage(readiness: DemoAuthReadiness | null) {
  if (!readiness) return 'Account creation is not available on this deployment yet.';
  if (!readiness.database.hasDatabaseUrl) return 'This deployment is missing DATABASE_URL, so account creation cannot work yet.';
  if (readiness.database.connection === 'error') return 'This deployment cannot reach its database or its schema is not ready yet.';
  return 'Account creation is not available on this deployment yet.';
}

function getGoogleUnavailableMessage(readiness: DemoAuthReadiness | null) {
  if (!readiness) return 'Google sign-in is not configured on this deployment yet.';
  if (!readiness.auth.googleConfigured) return 'Google sign-in is disabled because GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.';
  if (readiness.database.connection !== 'ok') return getSignUpUnavailableMessage(readiness);
  return 'Google sign-in is not configured on this deployment yet.';
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
  const [authReadiness, setAuthReadiness] = useState<DemoAuthReadiness | null>(null);

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
  const googleEnabled = providers?.google ?? true;
  const deploymentWarnings = authReadiness?.warnings ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!credentialsEnabled) {
      setError(getSignUpUnavailableMessage(authReadiness));
      return;
    }

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
    if (!googleEnabled) {
      setError(getGoogleUnavailableMessage(authReadiness));
      return;
    }
    setIsGoogleLoading(true);
    await signIn('google', { callbackUrl });
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Save lists across devices, link carts in seconds and keep every receipt."
      footer={
        <p>
          Already have an account?{' '}
          <Link className="font-semibold text-primary hover:underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
            Sign in
          </Link>
        </p>
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

      <Button
        variant="outline"
        size="lg"
        fullWidth
        onClick={handleGoogleSignIn}
        loading={isGoogleLoading}
        disabled={isLoading || isGoogleLoading || !googleEnabled}
      >
        {!isGoogleLoading && <GoogleIcon />}
        {isGoogleLoading ? 'Opening…' : 'Continue with Google'}
      </Button>

      <AuthDivider>or sign up with email</AuthDivider>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Alex Johnson"
          leading={<UserRound aria-hidden="true" />}
          value={name}
          error={fieldErrors.name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) {
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }
          }}
        />

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
          autoComplete="new-password"
          placeholder="Create a password"
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
          disabled={isLoading || isGoogleLoading || !credentialsEnabled}
        >
          {isLoading ? 'Creating account…' : credentialsEnabled ? 'Create account' : 'Account creation unavailable'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  );
}
