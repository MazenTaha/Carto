'use client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
interface PageContainerProps { children: React.ReactNode; maxWidth?: 'md' | 'lg' | '2xl' | 'full'; className?: string; }
export function PageContainer({ children, maxWidth = 'md', className }: PageContainerProps) {
  const maxWidthClass = { 'md': 'max-w-md', 'lg': 'max-w-lg', '2xl': 'max-w-2xl', 'full': 'max-w-full' }[maxWidth];
  return (
    <div className={cn("relative flex min-h-screen w-full flex-col mx-auto bg-white dark:bg-background-dark shadow-xl overflow-x-hidden", maxWidthClass, className)}>
      {children}
    </div>
  );
}
