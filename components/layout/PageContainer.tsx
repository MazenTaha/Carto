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
        'relative mx-auto flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-background-light px-4 text-slate-900 dark:bg-background-light dark:text-slate-900 sm:px-5 lg:px-6',
        maxWidthClass,
        className
      )}
    >
      {children}
    </div>
  );
}
