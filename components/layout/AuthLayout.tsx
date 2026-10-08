import Link from 'next/link';
import { ReactNode } from 'react';
import { ListChecks, ReceiptText, ScanLine } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const HIGHLIGHTS = [
  { icon: ListChecks, title: 'Plan before you go', text: 'Build reusable lists with quantities and prices.' },
  { icon: ScanLine, title: 'Scan to link a cart', text: 'Your list appears on the smart cart display instantly.' },
  { icon: ReceiptText, title: 'Live receipt & checkout', text: 'Track your total and pay securely when you are done.' },
];

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand-500/40 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-brand-950/40 blur-3xl"
          aria-hidden="true"
        />
        <Link href="/" aria-label="Carto home" className="relative w-fit">
          <Logo height={34} variant="white" priority />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-white">
            Your list, on the cart, in your pocket.
          </p>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, text }) => (
              <li key={itemTitle} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{itemTitle}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main id="main-content" className="flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:px-12">
        <div className="flex items-center lg:hidden">
          <Link href="/" aria-label="Carto home">
            <Logo height={28} priority />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-10">
          <h1 className="text-[2rem] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-muted">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
        {footer && <div className="mx-auto w-full max-w-[26rem] pb-2 text-center text-sm text-ink-subtle">{footer}</div>}
      </main>
    </div>
  );
}
