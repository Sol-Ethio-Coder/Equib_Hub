import { useT } from '@/lib/i18n';

export type PlanInfo = { state: 'TRIAL' | 'PRO' | 'EXPIRED'; daysLeft: number };

export function PlanBadge({ plan }: { plan?: PlanInfo }) {
  const t = useT();
  if (!plan) return null;
  const map = {
    TRIAL: ['bg-gold/20 text-gold', t('plan.trial', { n: plan.daysLeft })],
    PRO: ['bg-brand/15 text-brand', t('plan.pro', { n: plan.daysLeft })],
    EXPIRED: ['bg-danger/15 text-danger', t('plan.expired')],
  } as const;
  const [cls, text] = map[plan.state];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}
