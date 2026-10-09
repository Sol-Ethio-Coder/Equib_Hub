import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { FormError } from '@/components/Form';
import { api } from '@/lib/api';
import { STATUS_STYLE } from '@/lib/format';
import { usePrefs } from '@/lib/i18n';

type U = { id: string; fullName: string; email: string; phone: string | null; platformRole: string; status: string; emailVerified: boolean; createdAt: string; lastLoginAt: string | null };
type A = { id: string; action: string; createdAt: string; ip?: string; entityType?: string; actor?: { fullName: string } | null };

export default function AdminPage() {
  const qc = useQueryClient();
  const { fmtDate } = usePrefs();
  const [tab, setTab] = useState<'users' | 'audit'>('users'), [q, setQ] = useState(''), [err, setErr] = useState('');
  const users = useQuery({ queryKey: ['admin-users', q], enabled: tab === 'users', queryFn: () => api<{ users: U[] }>(`/admin/users?q=${encodeURIComponent(q)}`) });
  const audit = useQuery({ queryKey: ['audit'], enabled: tab === 'audit', queryFn: () => api<{ items: A[] }>('/audit') });
  const setStatus = async (u: U) => {
    const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (next === 'SUSPENDED' && !window.confirm(`Suspend ${u.fullName}? They will be signed out everywhere.`)) return;
    setErr('');
    try { await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { status: next } }); qc.invalidateQueries({ queryKey: ['admin-users'] }); } catch (e) { setErr((e as Error).message); }
  };
  const tabBtn = (k: 'users' | 'audit', label: string) => <button className={tab === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab(k)}>{label}</button>;
  return (
    <AppShell>
      <Link to="/app" className="text-sm text-brand hover:underline">← Dashboard</Link>
      <h1 className="mt-2 text-2xl font-bold">Platform admin</h1>
      <p className="text-muted">Manage users and review what administrators have done.</p>
      <div className="mt-5 flex gap-2">{tabBtn('users', 'Users')}{tabBtn('audit', 'Activity log')}</div>
      <FormError>{err}</FormError>
      {tab === 'users' && <>
        <input className="input mt-4 max-w-sm" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-muted"><tr><th className="p-3">User</th><th className="p-3">Phone</th><th className="p-3">Joined</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
          <tbody>
            {users.isLoading && <tr><td colSpan={5} className="p-6"><div className="h-6 animate-pulse rounded bg-line" /></td></tr>}
            {users.data?.users.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted">No users match your search.</td></tr>}
            {users.data?.users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="p-3"><p className="font-medium">{u.fullName}{u.platformRole === 'SUPER_ADMIN' && <span className="ml-2 text-xs text-gold">Super Admin</span>}</p><p className="text-xs text-muted">{u.email}{u.emailVerified ? '' : ' · unverified'}</p></td>
                <td className="p-3">{u.phone ?? '—'}</td><td className="p-3">{fmtDate(u.createdAt)}</td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[u.status] ?? ''}`}>{u.status.charAt(0) + u.status.slice(1).toLowerCase()}</span></td>
                <td className="p-3 text-right">{u.platformRole !== 'SUPER_ADMIN' && <button className="btn-ghost !py-1.5" onClick={() => setStatus(u)}>{u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>}</td>
              </tr>))}
          </tbody></table></div>
      </>}
      {tab === 'audit' && (
        <div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">IP</th></tr></thead>
          <tbody>
            {audit.data?.items.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted">No activity recorded yet.</td></tr>}
            {audit.data?.items.map((a) => <tr key={a.id} className="border-b border-line last:border-0"><td className="p-3">{fmtDate(a.createdAt)} {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td className="p-3">{a.actor?.fullName ?? 'System'}</td><td className="p-3 font-mono text-xs">{a.action}</td><td className="p-3 text-muted">{a.ip ?? ''}</td></tr>)}
          </tbody></table></div>)}
    </AppShell>
  );
}
