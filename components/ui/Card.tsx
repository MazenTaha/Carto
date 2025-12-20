// Reusable Card component

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div className={cn('bg-white rounded-lg shadow-md p-6', className)}>
      {title && (
        <h2 className="text-xl font-semibold mb-4 text-gray-900">{title}</h2>
      )}
      {children}
    </div>
  );
}

