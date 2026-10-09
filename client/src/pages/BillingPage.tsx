import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { FormError, FormSuccess } from '@/components/Form';
import { PlanBadge, PlanInfo } from '@/components/PlanBadge';
import { api, upload } from '@/lib/api';
import { money, STATUS_STYLE } from '@/lib/format';
import { usePrefs } from '@/lib/i18n';

type Item = { id: string; months: number; amountMinor: number; currency: string; method: string; status: string; rejectionReason: string | null; createdAt: string };
const STATUS_LABEL: Record<string, string> = { SUBMITTED: 'Waiting for review', VERIFIED: 'Approved', REJECTED: 'Rejected' };
const STYLE: Record<string, string> = { ...STATUS_STYLE, SUBMITTED: STATUS_STYLE.SUBMITTED };

export default function BillingPage() {
  const { groupId = '' } = useParams();
  const qc = useQueryClient();
  const { fmtDate } = usePrefs();
  const info = useQuery({ queryKey: ['billing-info'], queryFn: () => api<{ priceMinor: number; currency: string; trialDays: number; instructions: string }>('/billing/info') });
  const q = useQuery({ queryKey: ['billing', groupId], queryFn: () => api<{ group: { name: string }; plan: PlanInfo; items: Item[] }>(`/billing/groups/${groupId}`) });
  const [months, setMonths] = useState(1), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ok, setOk] = useState('');
  const price = info.data?.priceMinor ?? 50000;
  const waiting = q.data?.items.some((i) => i.status === 'SUBMITTED');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr(''); setOk('');
    const form = e.currentTarget, data = new FormData(form);
    data.set('months', String(months));
    try {
      await upload(`/billing/groups/${groupId}/pay`, data);
      setOk('Payment sent. We will review it and activate Pro, usually within a day.'); form.reset();
      qc.invalidateQueries({ queryKey: ['billing', groupId] });
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <AppShell>
      <Link to={`/app/groups/${groupId}`} className="text-sm text-brand hover:underline">← Back to {q.data?.group.name ?? 'Equb'}</Link>
      <h1 className="mt-2 text-2xl font-bold">Pro plan</h1>
      <div className="mt-2"><PlanBadge plan={q.data?.plan} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Upgrade this Equb</h2>
          <p className="mt-1 text-muted">{money(price)} per month for this group. Every {info.data?.trialDays ?? 30}-day trial ends automatically, and then the group pauses until Pro is active. Your data is kept.</p>
          <div className="mt-4 rounded-xl border border-line bg-bg p-4 text-sm"><p className="font-semibold">How to pay</p><p className="mt-1 whitespace-pre-line text-muted">{info.data?.instructions}</p></div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div><label className="label" htmlFor="months">Months</label>
              <select id="months" className="input" value={months} onChange={(e) => setMonths(+e.target.value)}>
                {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''} · {money(price * m)}</option>)}
              </select></div>
            <div><label className="label" htmlFor="method">Payment method</label>
              <select id="method" name="method" className="input" defaultValue="TELEBIRR">{['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CASH', 'OTHER'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></div>
            <div><label className="label" htmlFor="file">Receipt (JPG, PNG, WebP or PDF, max 5 MB)</label>
              <input id="file" name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="input" /></div>
            <FormError>{err}</FormError><FormSuccess>{ok}</FormSuccess>
            <button className="btn-primary w-full" disabled={busy || waiting}>{waiting ? 'A payment is waiting for review' : busy ? 'Sending…' : `Send payment · ${money(price * months)}`}</button>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold">Payment history</h2>
          {q.isLoading && <div className="mt-4 h-16 animate-pulse rounded bg-line" />}
          {q.data?.items.length === 0 && <p className="mt-3 text-sm text-muted">No Pro payments yet.</p>}
          <ul className="mt-3 divide-y divide-line">
            {q.data?.items.map((i) => (
              <li key={i.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{i.months} month{i.months > 1 ? 's' : ''} · {money(i.amountMinor, i.currency)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[i.status] ?? ''}`}>{STATUS_LABEL[i.status] ?? i.status}</span>
                </div>
                <p className="mt-1 text-muted">{fmtDate(i.createdAt)} · {i.method.replace('_', ' ')} · <a className="text-brand hover:underline" href={`/api/billing/receipt/${i.id}`} target="_blank" rel="noreferrer">receipt</a></p>
                {i.rejectionReason && <p className="mt-1 text-danger">{i.rejectionReason}</p>}
              </li>))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
