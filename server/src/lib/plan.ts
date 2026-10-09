export type PlanState = 'TRIAL' | 'PRO' | 'EXPIRED';
export type Plan = { state: PlanState; active: boolean; endsAt: string | null; daysLeft: number };
const DAY = 86_400_000;

/** A group works while its free trial or its paid Pro period is running. Otherwise it is paused. */
export function planOf(g: { trialEndsAt?: Date | null; proUntil?: Date | null }): Plan {
  const now = Date.now();
  const pro = g.proUntil ? new Date(g.proUntil).getTime() : 0;
  const trial = g.trialEndsAt ? new Date(g.trialEndsAt).getTime() : 0;
  if (pro > now) return { state: 'PRO', active: true, endsAt: new Date(pro).toISOString(), daysLeft: Math.ceil((pro - now) / DAY) };
  if (trial > now) return { state: 'TRIAL', active: true, endsAt: new Date(trial).toISOString(), daysLeft: Math.ceil((trial - now) / DAY) };
  return { state: 'EXPIRED', active: false, endsAt: null, daysLeft: 0 };
}
