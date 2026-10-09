import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { FormError } from '@/components/Form';
import { api, upload } from '@/lib/api';
import { money, STATUS_STYLE } from '@/lib/format';
import { PlanBadge, PlanInfo } from '@/components/PlanBadge';
import { Avatar } from '@/components/Avatar';
import { useT, usePrefs } from '@/lib/i18n';
import { useAuth } from '@/context/AuthContext';

type P = { id: string; status: string; expectedMinor: number; paidMinor: number | null; currency: string; method: string | null; rejectionReason: string | null; membership: { user: { fullName: string; email: string } }; receipts: { id: string }[] };
type M = { id: string; userId: string; hasPhoto: boolean; role: string; status: string; user: { fullName: string; email: string; phone: string | null } };
function Badge({ s }: { s: string }) { const t = useT(); return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[s] ?? ''}`}>{t('st.' + s)}</span>; }

function ReportsMenu({ groupId, period }: { groupId: string; period: string }) {
  const t = useT();
  const items: [string, string][] = [['monthly', 'Monthly contributions'], ['outstanding', 'Outstanding payments'], ['summary', 'Financial summary']];
  return (
    <details className="relative">
      <summary className="btn-ghost cursor-pointer list-none">{t('reports')} ▾</summary>
      <div className="card absolute left-0 z-10 mt-2 w-72 p-2 shadow-lg">
        {items.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-bg"><span>{label}</span>
            <span className="flex gap-2"><a className="font-semibold text-brand hover:underline" href={`/api/groups/${groupId}/reports/${k}.csv?period=${period}`}>CSV</a><a className="font-semibold text-brand hover:underline" href={`/api/groups/${groupId}/reports/${k}.pdf?period=${period}`}>PDF</a></span></div>))}
        <p className="px-3 pb-2 pt-1 text-xs text-muted">Per-member history: use the PDF link in the members table.</p>
      </div>
    </details>
  );
}
const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function GroupPage() {
  const { groupId = '' } = useParams();
  const t = useT();
  const { fmtDate } = usePrefs();
  const isAdmin = useAuth().me?.user.platformRole === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const [period, setPeriod] = useState(thisMonth()), [method, setMethod] = useState('TELEBIRR'), [q, setQ] = useState(''), [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');
  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => api<{ group: { name: string; description: string | null; contributionMinor: number; currency: string; frequency: string }; plan: PlanInfo; canManage: boolean }>(`/groups/${groupId}`) });
  const canManage = group.data?.canManage ?? false;
  const plan = group.data?.plan;
  const paused = plan?.state === 'EXPIRED';
  const live = !!group.data && (!paused || isAdmin);
  const pays = useQuery({ queryKey: ['payments', groupId, period], enabled: live, queryFn: () => api<{ payments: P[]; canManage: boolean }>(`/groups/${groupId}/payments?period=${period}`) });
  const members = useQuery({ queryKey: ['members', groupId], enabled: canManage && live, queryFn: () => api<{ members: M[] }>(`/groups/${groupId}/members`) });
  const ann = useQuery({ queryKey: ['ann', groupId], enabled: live, queryFn: () => api<{ items: { id: string; title: string; body: string; author: string; createdAt: string }[] }>(`/groups/${groupId}/announcements`) });
  const postAnn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = e.currentTarget; const d = Object.fromEntries(new FormData(f));
    await run(() => api(`/groups/${groupId}/announcements`, { method: 'POST', body: d }).then(() => { f.reset(); qc.invalidateQueries({ queryKey: ['ann', groupId] }); }));
  };
  const [invite, setInvite] = useState('');
  const makeInvite = () => run(async () => { const r = await api<{ link: string }>(`/groups/${groupId}/invites`, { method: 'POST' }); setInvite(r.link); try { await navigator.clipboard.writeText(r.link); } catch { /* clipboard blocked: link is shown below */ } });
  const addMember = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = e.currentTarget; const email = String(new FormData(f).get('email') ?? '');
    await run(() => api(`/groups/${groupId}/members`, { method: 'POST', body: { email } }).then(() => f.reset()));
  };
  const refresh = () => { qc.invalidateQueries({ queryKey: ['payments', groupId] }); qc.invalidateQueries({ queryKey: ['members', groupId] }); };
  const run = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); refresh(); } catch (e) { setError((e as Error).message); } };

  const list = (pays.data?.payments ?? []).filter((p) => (filter === 'ALL' || p.status === filter) && (p.membership.user.fullName + p.membership.user.email).toLowerCase().includes(q.toLowerCase()));
  const all = pays.data?.payments ?? [];
  const sum = (st?: string) => all.filter((p) => !st || p.status === st).reduce((a, p) => a + (st ? (p.paidMinor ?? p.expectedMinor) : p.expectedMinor), 0);
  const cur = group.data?.group.currency;

  const onFile = (p: P, file?: File) => file && run(() => { const f = new FormData(); f.append('file', file); f.append('method', method); f.append('amount', String(p.expectedMinor / 100)); return upload(`/groups/${groupId}/payments/${p.id}/receipt`, f); });
  const reject = (p: P) => { const reason = window.prompt(`Why is ${p.membership.user.fullName}'s receipt being rejected?`); if (reason) run(() => api(`/groups/${groupId}/payments/${p.id}/reject`, { method: 'POST', body: { reason } })); };
  const act = (m: M, action: string, confirm?: string) => { if (confirm && !window.confirm(confirm)) return; run(() => api(`/groups/${groupId}/members/${m.id}`, { method: 'PATCH', body: { action } })); };

  return (
    <AppShell>
      <Link to="/app" className="text-sm text-brand hover:underline">← Dashboard</Link>
      {group.isError && (
        <div className="card mt-6 p-8 text-center">
          <h1 className="text-xl font-bold">We couldn't open this Equb</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">{(group.error as Error).message} The link may be old, or you may not be an approved member of this group.</p>
          <Link to="/app" className="btn-primary mt-5">Back to dashboard</Link>
        </div>
      )}
      <h1 className="mt-2 text-2xl font-bold">{group.data?.group.name ?? (group.isError ? '' : 'Equb')}</h1>
      <p className="text-muted">{group.data && `${money(group.data.group.contributionMinor, cur)} per ${group.data.group.frequency.toLowerCase()} contribution`}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <PlanBadge plan={plan} />
        {isAdmin && plan?.state !== 'PRO' && <button className="text-sm font-semibold text-gold hover:underline" onClick={() => run(() => api(`/admin/groups/${groupId}/extend-trial`, { method: 'POST', body: { days: 30 } }).then(() => qc.invalidateQueries({ queryKey: ['group', groupId] })))}>Extend trial +30 days</button>}
        {canManage && plan && plan.state !== 'PRO' && <Link to={`/app/groups/${groupId}/billing`} className="text-sm font-semibold text-brand hover:underline">Upgrade to Pro</Link>}
        {canManage && plan?.state === 'PRO' && <Link to={`/app/groups/${groupId}/billing`} className="text-sm text-brand hover:underline">Billing</Link>}
      </div>
      {paused && !isAdmin && (
        <div className="card mt-8 p-8 text-center">
          <h2 className="text-xl font-bold">This Equb is paused</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">{canManage ? 'Your free trial has ended. Upgrade to Pro to unlock members, payments and receipts again. Nothing has been deleted.' : 'The free trial for this Equb has ended. Ask your group leader to upgrade to Pro to continue.'}</p>
          {canManage && <Link to={`/app/groups/${groupId}/billing`} className="btn-primary mt-5">Upgrade to Pro</Link>}
        </div>
      )}
      {live && <>
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[[t('expected'), money(sum(), cur)], [t('st.VERIFIED'), money(sum('VERIFIED'), cur)], [t('awaiting'), all.filter((p) => p.status === 'SUBMITTED').length], [t('st.OVERDUE'), all.filter((p) => p.status === 'OVERDUE').length]].map(([l, v]) => (
          <div key={l as string} className="card p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 font-display text-xl font-bold">{v}</p></div>))}
      </section>

      {all.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label="Payment status breakdown">
            {(['VERIFIED', 'SUBMITTED', 'PENDING', 'REJECTED', 'OVERDUE'] as const).map((st) => { const n = all.filter((p) => p.status === st).length; return n ? <div key={st} style={{ width: `${(n / all.length) * 100}%` }} className={{ VERIFIED: 'bg-brand', SUBMITTED: 'bg-gold', PENDING: 'bg-muted/40', REJECTED: 'bg-danger/60', OVERDUE: 'bg-danger' }[st]} title={`${st}: ${n}`} /> : null; })}
          </div>
          <p className="mt-2 text-xs text-muted">{['VERIFIED', 'SUBMITTED', 'PENDING', 'REJECTED', 'OVERDUE'].map((st) => `${st.charAt(0) + st.slice(1).toLowerCase()} ${all.filter((p) => p.status === st).length}`).join(' · ')}</p>
        </div>)}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="p">{t('month')}</label><input id="p" type="month" className="input" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} /></div>
        {canManage && <>
          <div className="min-w-48 flex-1"><label className="label" htmlFor="s">{t('search')}</label><input id="s" className="input" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div><label className="label" htmlFor="f">{t('status')}</label><select id="f" className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>{['ALL', 'PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'OVERDUE'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <button className="btn-ghost" onClick={() => run(() => api(`/groups/${groupId}/payments/generate`, { method: 'POST', body: { period } }))}>{t('createRecords')}</button>
          <ReportsMenu groupId={groupId} period={period} />
        </>}
        {!canManage && <div><label className="label" htmlFor="m">Payment method</label><select id="m" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CASH', 'OTHER'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>}
      </div>
      {!canManage && live && <div className="mt-3"><a className="btn-ghost" href={`/api/groups/${groupId}/reports/history.pdf`}>{t('myHistory')}</a></div>}
      <div className="mt-3"><FormError>{error}</FormError></div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-muted"><tr><th className="p-3">Member</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {pays.isLoading && <tr><td colSpan={4} className="p-6"><div className="h-6 animate-pulse rounded bg-line" /></td></tr>}
            {!pays.isLoading && list.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-muted">No payment records found for {period}.{canManage ? ' Use "Create this month\'s records" to start.' : ''}</td></tr>}
            {list.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="p-3"><p className="font-medium">{p.membership.user.fullName}</p><p className="text-xs text-muted">{p.membership.user.email}</p></td>
                <td className="p-3">{money(p.paidMinor ?? p.expectedMinor, p.currency)}</td>
                <td className="p-3"><Badge s={p.status} />{p.rejectionReason && <p className="mt-1 max-w-xs text-xs text-danger">{p.rejectionReason}</p>}</td>
                <td className="p-3"><div className="flex flex-wrap justify-end gap-2">
                  {p.receipts[0] && <a className="btn-ghost !py-1.5" href={`/api/receipts/${p.receipts[0].id}`} target="_blank" rel="noreferrer">{t('viewReceipt')}</a>}
                  {canManage && p.status === 'SUBMITTED' && <>
                    <button className="btn-primary !py-1.5" onClick={() => run(() => api(`/groups/${groupId}/payments/${p.id}/verify`, { method: 'POST' }))}>{t('verify')}</button>
                    <button className="btn-ghost !py-1.5 text-danger" onClick={() => reject(p)}>{t('reject')}</button></>}
                  {!canManage && ['PENDING', 'OVERDUE', 'REJECTED'].includes(p.status) && <label className="btn-primary cursor-pointer !py-1.5">{t('uploadReceipt')}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { onFile(p, e.target.files?.[0]); e.target.value = ''; }} /></label>}
                </div></td>
              </tr>))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-lg font-semibold">{t('announcements')}</h2>
      {canManage && (
        <form onSubmit={postAnn} className="card mt-3 grid gap-3 p-4">
          <input className="input" name="title" placeholder="Title, e.g. Payment deadline" required minLength={2} maxLength={100} aria-label="Announcement title" />
          <textarea className="input min-h-20" name="body" placeholder="Message to all members" required minLength={2} maxLength={1000} aria-label="Announcement message" />
          <button className="btn-primary justify-self-start">Post announcement</button>
        </form>)}
      <div className="mt-3 space-y-3">
        {ann.data?.items.length === 0 && <p className="card p-6 text-center text-sm text-muted">No announcements yet.</p>}
        {ann.data?.items.map((a) => (
          <article key={a.id} className="card p-4"><h3 className="font-semibold">{a.title}</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p><p className="mt-2 text-xs text-muted">{a.author} · {fmtDate(a.createdAt)}</p></article>))}
      </div>

      {canManage && <>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('members')}</h2>
          <button className="btn-ghost" onClick={makeInvite}>{t('invite')}</button>
        </div>
        {invite && <p className="card mt-3 break-all p-3 text-sm">Invite link (copied, valid 7 days, up to 20 people): <span className="font-mono text-brand">{invite}</span></p>}
        <form onSubmit={addMember} className="mt-3 flex flex-wrap gap-2">
          <input className="input max-w-xs" name="email" type="email" required placeholder="Add an existing user by email" aria-label="Member email" />
          <button className="btn-primary">{t('addMember')}</button>
        </form>
        <div className="card mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-muted"><tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>{members.data?.members.map((m) => (
            <tr key={m.id} className="border-b border-line last:border-0">
              <td className="p-3"><div className="flex items-center gap-3"><Avatar id={m.userId} name={m.user.fullName} hasPhoto={m.hasPhoto} size={32} /><div><p className="font-medium">{m.user.fullName}{m.role === 'LEADER' && <span className="ml-2 text-xs text-gold">Leader</span>}</p><p className="text-xs text-muted">{m.user.email}</p></div></div></td>
              <td className="p-3">{m.user.phone ?? '—'}</td><td className="p-3"><Badge s={m.status} /></td>
              <td className="p-3"><div className="flex flex-wrap justify-end gap-2">
                <a className="btn-ghost !py-1.5" href={`/api/groups/${groupId}/reports/history.pdf?membership=${m.id}`}>PDF</a>
                {isAdmin && m.status === 'ACTIVE' && (m.role === 'LEADER'
                  ? <button className="btn-ghost !py-1.5" onClick={() => act(m, 'make_member', `Make ${m.user.fullName} a regular member?`)}>Make member</button>
                  : <button className="btn-primary !py-1.5" onClick={() => act(m, 'make_leader', `Make ${m.user.fullName} a leader of this Equb?`)}>Make leader</button>)}
                {m.status === 'PENDING' && <button className="btn-primary !py-1.5" onClick={() => act(m, 'approve')}>{t('approve')}</button>}
                {m.status === 'ACTIVE' && (m.role !== 'LEADER' || isAdmin) && <button className="btn-ghost !py-1.5" onClick={() => act(m, 'suspend', `Suspend ${m.user.fullName}?`)}>{t('suspend')}</button>}
                {m.status === 'SUSPENDED' && <button className="btn-ghost !py-1.5" onClick={() => act(m, 'reactivate')}>{t('reactivate')}</button>}
                {(m.role !== 'LEADER' || isAdmin) && <button className="btn-ghost !py-1.5 text-danger" onClick={() => act(m, 'remove', `Remove ${m.user.fullName} from this Equb? This cannot be undone.`)}>{t('remove')}</button>}
              </div></td>
            </tr>))}</tbody></table></div>
      </>}
      </>}
    </AppShell>
  );
}
