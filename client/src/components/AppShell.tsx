import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/lib/i18n';
import { PrefsToggle } from '@/components/PrefsToggle';
import { Avatar } from '@/components/Avatar';
import { api } from '@/lib/api';

type N = { id: string; title: string; body: string; readAt: string | null };
function Bell() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: N[]; unread: number }>('/notifications'), refetchInterval: 60_000 });
  const read = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  return (
    <details className="relative" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && q.data?.unread && read.mutate()}>
      <summary className="btn-ghost list-none !px-3" aria-label={`Notifications, ${q.data?.unread ?? 0} unread`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
        {!!q.data?.unread && <span className="rounded-full bg-gold px-1.5 text-xs text-bg">{q.data.unread}</span>}
      </summary>
      <div className="card absolute right-0 z-10 mt-2 max-h-96 w-80 max-w-[90vw] overflow-auto p-2 shadow-lg">
        {q.data?.items.length ? q.data.items.map((n) => (
          <div key={n.id} className={`rounded-lg p-3 text-sm ${n.readAt ? '' : 'bg-brand/10'}`}><p className="font-semibold">{n.title}</p><p className="text-muted">{n.body}</p></div>
        )) : <p className="p-4 text-center text-sm text-muted">No notifications yet.</p>}
      </div>
    </details>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-5 py-3">
          <Link to="/app" aria-label="Dashboard"><Logo size={30} /></Link>
          <div className="flex items-center gap-2"><Bell />{me?.user.platformRole === 'SUPER_ADMIN' && <Link to="/app/admin" className="btn-ghost">{t('admin')}</Link>}<Link to="/app/profile" className="btn-ghost !px-2.5"><Avatar id={me?.user.id} name={me?.user.fullName} hasPhoto={me?.user.hasPhoto} v={me?.user.photoV} size={24} /><span className="ml-1.5 hidden sm:inline">{t('profile')}</span></Link><PrefsToggle /><ThemeToggle /><button className="btn-ghost" onClick={logout}>{t('signOut')}</button></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      <Footer />
    </div>
  );
}
