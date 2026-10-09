import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { FormError } from '@/components/Form';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

export default function JoinInvite() {
  const { token = '' } = useParams();
  const nav = useNavigate(), qc = useQueryClient();
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['invite', token], retry: false, queryFn: () => api<{ group: { name: string; description: string | null; contributionMinor: number; currency: string } }>(`/invites/${token}`) });
  const join = async () => {
    setBusy(true); setErr('');
    try { const r = await api<{ groupId: string }>(`/invites/${token}/accept`, { method: 'POST' }); await qc.invalidateQueries({ queryKey: ['me'] }); nav(`/app/groups/${r.groupId}`, { replace: true }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <AppShell>
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        {q.isLoading && <div className="h-24 animate-pulse rounded bg-line" />}
        {q.isError && <><h1 className="text-xl font-bold">Invite not available</h1><p className="mt-2 text-muted">{(q.error as Error).message}</p><Link to="/app" className="btn-primary mt-5">Go to dashboard</Link></>}
        {q.data && <>
          <p className="text-sm text-muted">You are invited to join</p>
          <h1 className="mt-1 text-2xl font-bold">{q.data.group.name}</h1>
          {q.data.group.description && <p className="mt-2 text-muted">{q.data.group.description}</p>}
          <p className="mt-3 text-sm">{money(q.data.group.contributionMinor, q.data.group.currency)} per contribution</p>
          <div className="mt-4"><FormError>{err}</FormError></div>
          <button className="btn-primary mt-5 w-full" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join this Equb'}</button>
        </>}
      </div>
    </AppShell>
  );
}
