import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { FormError, FormSuccess } from '@/components/Form';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { money } from '@/lib/format';
import { brand } from '@/config/brand';
import { useT } from '@/lib/i18n';
import { PlanBadge, PlanInfo } from '@/components/PlanBadge';

type G = { id: string; name: string; description: string | null; contributionMinor: number; currency: string; frequency: string; status: string; maxMembers: number; plan?: PlanInfo; _count: { memberships: number } };

function Stats() {
  const q = useQuery({ queryKey: ['stats'], queryFn: () => api<{ groups: number; members: number; proGroups: number; pendingBilling: number; monthly: { period: string; paidMinor: number }[]; byStatus: { status: string; count: number; expectedMinor: number; paidMinor: number }[] }>('/stats') });
  if (!q.data) return <div className="mt-6 h-24 animate-pulse rounded-2xl bg-line" />;
  const by = (s: string) => q.data.byStatus.find((x) => x.status === s);
  const expected = q.data.byStatus.reduce((a, b) => a + b.expectedMinor, 0), received = by('VERIFIED')?.paidMinor ?? 0;
  const cards = [['Equb groups', q.data.groups], ['Pro groups', q.data.proGroups], ['Active members', q.data.members], ['Pro payments to review', q.data.pendingBilling], ['Expected', money(expected)], ['Verified received', money(received)], ['Awaiting review', by('SUBMITTED')?.count ?? 0], ['Overdue', by('OVERDUE')?.count ?? 0]];
  const monthly = q.data.monthly ?? [], top = Math.max(1, ...monthly.map((m) => m.paidMinor));
  return <><section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([l, v]) => <div key={l as string} className="card p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 font-display text-xl font-bold">{v}</p></div>)}</section>
    <section className="card mt-4 p-5" aria-label="Verified contributions by month">
      <h2 className="font-semibold">Verified contributions by month</h2>
      {monthly.length === 0 ? <p className="mt-2 text-sm text-muted">No verified payments yet.</p> : (
        <div className="mt-4 flex h-36 items-end gap-3">
          {monthly.map((m) => (
            <div key={m.period} className="flex flex-1 flex-col items-center gap-1 text-xs text-muted">
              <span>{money(m.paidMinor).replace('ETB', '').trim()}</span>
              <div className="w-full rounded-t-lg bg-brand" style={{ height: `${Math.max(6, (m.paidMinor / top) * 100)}%` }} title={money(m.paidMinor)} />
              <span>{m.period.slice(2)}</span>
            </div>))}
        </div>)}
    </section></>;
}

type Pending = { id: string; group: string; by: string; email: string; months: number; amountMinor: number; currency: string; method: string };
function BillingReview() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['billing-pending'], queryFn: () => api<{ items: Pending[] }>('/billing/admin/pending') });
  const [err, setErr] = useState('');
  const done = () => { qc.invalidateQueries({ queryKey: ['billing-pending'] }); qc.invalidateQueries({ queryKey: ['stats'] }); };
  const act = async (b: Pending, ok: boolean) => {
    setErr('');
    try {
      if (ok) await api(`/billing/admin/${b.id}/approve`, { method: 'POST' });
      else { const reason = window.prompt(`Why is the payment from ${b.group} being rejected?`); if (!reason) return; await api(`/billing/admin/${b.id}/reject`, { method: 'POST', body: { reason } }); }
      done();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <section className="card mt-6 p-5">
      <h2 className="font-semibold">Pro payments to review</h2>
      <FormError>{err}</FormError>
      {q.data?.items.length === 0 && <p className="mt-2 text-sm text-muted">No Pro payments are waiting. New ones will appear here.</p>}
      <ul className="mt-3 divide-y divide-line">
        {q.data?.items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div><p className="font-medium">{b.group}</p><p className="text-muted">{b.by} · {b.months} month(s) · {money(b.amountMinor, b.currency)} · {b.method.replace('_', ' ')}</p></div>
            <div className="flex gap-2">
              <a className="btn-ghost !py-1.5" href={`/api/billing/receipt/${b.id}`} target="_blank" rel="noreferrer">View receipt</a>
              <button className="btn-primary !py-1.5" onClick={() => act(b, true)}>Approve</button>
              <button className="btn-ghost !py-1.5 text-danger" onClick={() => act(b, false)}>Reject</button>
            </div>
          </li>))}
      </ul>
    </section>
  );
}

function CreateGroup({ admin }: { admin: boolean }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const m = useMutation({ mutationFn: (b: Record<string, string>) => api('/groups', { method: 'POST', body: b }), onSuccess: () => { setMsg('Equb group created.'); qc.invalidateQueries({ queryKey: ['stats'] }); qc.invalidateQueries({ queryKey: ['groups'] }); qc.invalidateQueries({ queryKey: ['me'] }); } });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMsg(''); setErr(''); const f = e.currentTarget; const d = Object.fromEntries(new FormData(f)) as Record<string, string>;
    try { await m.mutateAsync(d); f.reset(); } catch (x) { setErr(x instanceof ApiError ? x.message : 'Could not create the group.'); }
  };
  return (
    <details className="card mt-6 p-5">
      <summary className="cursor-pointer font-semibold">{admin ? 'Create an Equb group' : `Start your Equb · ${brand.pricing.trialDays}-day free trial`}</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="input" name="name" placeholder="Group name" required minLength={3} aria-label="Group name" />
        {admin ? <input className="input" name="leaderEmail" type="email" placeholder="Leader's email (must have an account)" aria-label="Leader email" /> : <p className="self-center text-sm text-muted">You will be the leader. Your first group includes a {brand.pricing.trialDays}-day free trial.</p>}
        <input className="input" name="contributionAmount" type="number" min="1" step="0.01" placeholder="Contribution per member (ETB)" required aria-label="Contribution amount" />
        <input className="input" name="maxMembers" type="number" min="2" placeholder="Number of members" required aria-label="Number of members" />
        <input className="input sm:col-span-2" name="description" placeholder="Description (optional)" aria-label="Description" />
        <div className="sm:col-span-2 space-y-2"><FormError>{err}</FormError><FormSuccess>{msg}</FormSuccess><button className="btn-primary" disabled={m.isPending}>{m.isPending ? 'Creating…' : 'Create group'}</button></div>
      </form>
    </details>
  );
}

export default function Dashboard() {
  const { me } = useAuth();
  const t = useT();
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api<{ groups: G[] }>('/groups') });
  const join = useMutation({ mutationFn: (id: string) => api(`/groups/${id}/join`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
  if (!me) return null;
  const { user, memberships } = me, admin = user.platformRole === 'SUPER_ADMIN';
  const mine = new Set(memberships.map((m) => m.group.id));
  return (
    <AppShell>
      <h1 className="text-2xl font-bold">{t('hello')}, {user.fullName.split(' ')[0]}</h1>
      <p className="mt-1 text-muted">{admin ? 'Platform overview and all Equb groups.' : 'Your Equb groups and contributions.'}</p>
      {!user.emailVerified && <p className="mt-4 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm">Your email isn't verified yet. Check your inbox for the confirmation link. <button className="font-semibold text-brand underline" onClick={() => api('/auth/resend-verification', { method: 'POST' }).then(() => alert('Verification email sent. In development, check the API terminal.')).catch((e) => alert(e.message))}>Resend email</button></p>}
      {admin && <><Stats /><BillingReview /></>}
      <CreateGroup admin={admin} />

      <h2 className="mt-8 text-lg font-semibold">{admin ? 'Groups you belong to' : t('myEqubs')}</h2>
      <section className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.length === 0 && <div className="card col-span-full p-8 text-center"><h3 className="font-semibold">You haven't joined an Equb yet</h3><p className="mt-1 text-sm text-muted">Request to join one below.</p></div>}
        {memberships.map((m) => (
          m.status === 'PENDING' ? (
            <div key={m.id} className="card p-5 opacity-80">
              <h3 className="font-semibold">{m.group.name}</h3>
              <p className="mt-2 text-sm text-muted">Request sent. Waiting for the leader to approve you.</p>
            </div>
          ) : (
            <Link key={m.id} to={`/app/groups/${m.group.id}`} className="card p-5 transition hover:border-brand">
              <h3 className="font-semibold">{m.group.name}</h3>
              <div className="mt-1.5"><PlanBadge plan={m.group.plan} /></div>
              <p className="mt-2 text-sm text-muted">{m.role === 'LEADER' ? 'Leader' : 'Member'} · active</p>
            </Link>
          )
        ))}
      </section>

      <h2 className="mt-8 text-lg font-semibold">{admin ? 'All groups' : t('findEqub')}</h2>
      <section className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.isLoading && <div className="h-28 animate-pulse rounded-2xl bg-line" />}
        {groups.data?.groups.map((g) => (
          <div key={g.id} className="card flex flex-col p-5">
            <h3 className="font-semibold">{g.name}</h3>
            {admin && <div className="mt-1.5"><PlanBadge plan={g.plan} /></div>}
            <p className="mt-1 flex-1 text-sm text-muted">{g.description}</p>
            <p className="mt-3 text-sm">{money(g.contributionMinor, g.currency)} / {g.frequency.toLowerCase()} · {g._count.memberships}/{g.maxMembers} members</p>
            {admin ? <Link className="btn-ghost mt-3" to={`/app/groups/${g.id}`}>{t('open')}</Link>
              : mine.has(g.id) ? <span className="mt-3 text-sm text-muted">You're already in this group</span>
              : <button className="btn-primary mt-3" disabled={join.isPending} onClick={() => join.mutate(g.id)}>{t('requestJoin')}</button>}
          </div>
        ))}
        {join.error && <div className="col-span-full"><FormError>{(join.error as Error).message}</FormError></div>}
      </section>
    </AppShell>
  );
}
