import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const inputClassName =
  'block h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink shadow-xs ' +
  'placeholder:text-ink-subtle/80 transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle sm:text-[0.9375rem]';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Element rendered inside the field on the left (usually an icon). */
  leading?: ReactNode;
  /** Element rendered inside the field on the right (e.g. a show-password toggle). */
  trailing?: ReactNode;
  labelAction?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leading, trailing, labelAction, containerClassName, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className={cn('w-full', containerClassName)}>
        {(label || labelAction) && (
          <div className="mb-1.5 flex items-center justify-between gap-3">
            {label && (
              <label htmlFor={inputId} className="text-sm font-medium text-ink">
                {label}
              </label>
            )}
            {labelAction}
          </div>
        )}
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-subtle [&_svg]:size-[1.125rem]">
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              inputClassName,
              leading && 'pl-11',
              trailing && 'pr-12',
              error && 'border-red-400 focus:border-red-500 focus:ring-red-500/10',
              className
            )}
            {...props}
          />
          {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-700">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-ink-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
