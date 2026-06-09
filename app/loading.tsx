import { PageContainer } from '@/components/layout/PageContainer';

export default function Loading() {
  return (
    <PageContainer className="justify-center">
      <main className="flex min-h-screen items-center justify-center py-10">
        <div className="w-full max-w-sm rounded-[2.5rem] border border-warm-border/50 bg-white/90 p-10 text-center shadow-soft backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Loading Carto</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Preparing your shopping session and account data.
          </p>
        </div>
      </main>
    </PageContainer>
  );
}
