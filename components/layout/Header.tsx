'use client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
interface HeaderProps { title?: string; showBack?: boolean; onBack?: () => void; rightElement?: React.ReactNode; sticky?: boolean; className?: string; }
export function Header({ title, showBack = false, onBack, rightElement, sticky = true, className }: HeaderProps) {
  return (
    <header className={cn("flex items-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-md p-4 z-40 border-b border-primary/10", sticky && "sticky top-0", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center">
        {showBack && (
          <button onClick={onBack || (() => window.history.back())} className="text-slate-900 dark:text-slate-100 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer p-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
      </div>
      {title && <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{title}</h2>}
      <div className="flex size-10 items-center justify-center">{rightElement}</div>
    </header>
  );
}
