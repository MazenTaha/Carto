'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { signInSchema } from '@/lib/validations';
import { Logo } from '@/components/ui/Logo';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate input
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
      // First try to set guest bypass cookie
      const bypassResponse = await fetch('/api/auth/guest-bypass');

      if (bypassResponse.ok) {
        // Try to create guest user in database (optional)
        try {
          const guestResponse = await fetch('/api/auth/guest', {
            method: 'POST',
          });

          if (guestResponse.ok) {
            const guestData = await guestResponse.json();
            // Sign in as guest user
            const result = await signIn('credentials', {
              email: guestData.data.email,
              password: guestData.data.password,
              redirect: false,
            });

            if (!result?.error) {
              router.push('/dashboard');
              router.refresh();
              return;
            }
          }
        } catch (dbError) {
          // Database not available, continue with bypass
          console.log('Database not available, using bypass mode');
        }

        // Use bypass mode (no database required)
        router.push('/dashboard');
        router.refresh();
      } else {
        throw new Error('Failed to enable guest mode');
      }
    } catch (err: any) {
      console.error('Skip error:', err);
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <Link href="/dashboard">
            <Logo width={180} height={60} className="mb-8" />
          </Link>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4"
            onClick={handleSkip}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Skip & Continue as Guest'}
          </Button>
        </div>
      </div>
    </div>
  );
}

