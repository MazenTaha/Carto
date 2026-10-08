import Image from 'next/image';
import { cn } from '@/lib/utils';

const WORDMARK_RATIO = 640 / 280;

interface LogoProps {
  /** Rendered height in px; width follows the wordmark's aspect ratio. */
  height?: number;
  variant?: 'dark' | 'white';
  className?: string;
  priority?: boolean;
}

export function Logo({ height = 28, variant = 'dark', className, priority = false }: LogoProps) {
  const width = Math.round(height * WORDMARK_RATIO);

  return (
    <Image
      src={variant === 'white' ? '/images/carto-wordmark-white.png' : '/images/carto-wordmark.png'}
      alt="Carto"
      width={width}
      height={height}
      className={cn('shrink-0 select-none', className)}
      priority={priority}
    />
  );
}
