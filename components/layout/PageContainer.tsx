'use client';

import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | '2xl' | 'full';
  className?: string;
}

export function PageContainer({ children, maxWidth = 'md', className }: PageContainerProps) {
  const maxWidthClass = {
    md: 'max-w-5xl',
    lg: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-full',
  }[maxWidth];

  return (
    <div
      className={cn(
        'relative mx-auto flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100 sm:px-4 lg:px-6',
        maxWidthClass,
        className
      )}
    >
      {children}
    </div>
  );
}
