'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevents closing via backdrop, Escape, or the close button (e.g. while a request is in flight). */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Lets the body manage its own scrolling (e.g. a search panel with a sticky header). */
  bodyClassName?: string;
  className?: string;
  hideCloseButton?: boolean;
}

const sizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Accessible dialog that renders as a bottom sheet on phones and a centered dialog from `sm` up.
 * Handles Escape, scroll locking, initial focus and focus return.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = 'md',
  bodyClassName,
  className,
  hideCloseButton = false,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Capture the trigger during render: children with `autoFocus` take focus during commit,
  // before effects run, so reading document.activeElement in the effect would be too late.
  if (open && !returnFocusRef.current && typeof document !== 'undefined') {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
  }
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const autoFocus = panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (autoFocus ?? panel).focus();
    }, 20);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const returnTarget = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px] animate-fade-in"
        aria-hidden="true"
        onClick={() => {
          if (dismissible) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-overlay outline-none animate-sheet-in',
          'sm:max-h-[min(88dvh,56rem)] sm:rounded-3xl',
          sizes[size],
          className
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
        {(title || !hideCloseButton) && (
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-xl font-semibold leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-subtle transition hover:bg-surface-muted hover:text-ink disabled:opacity-40"
                aria-label="Close"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {children ? (
          <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6', bodyClassName)}>
            {children}
          </div>
        ) : (
          <div className="pb-2" />
        )}
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pb-safe pt-4 sm:px-6 sm:pb-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
