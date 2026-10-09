import { env } from '../config/env.js';
import { EqubGroup, Payment } from '../models/index.js';
import { notify, notifyLeaders } from '../lib/notify.js';
import { planOf } from '../lib/plan.js';

const DAY = 86_400_000;

/**
 * Runs every few hours:
 *  - marks unpaid past months as OVERDUE
 *  - reminds members from 3 days before the due day, then flags overdue (max one message per 3 days each)
 *  - warns leaders when a trial or Pro plan has 2 days or less left
 */
export async function runReminders(now = new Date()) {
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await Payment.updateMany({ status: 'PENDING', period: { $lt: thisMonth } }, { status: 'OVERDUE' });
  const groups = await EqubGroup.find({ status: 'ACTIVE' });
  for (const g of groups) {
    const plan = planOf(g);
    if (!plan.active) continue;
    if (plan.daysLeft <= 2 && (!g.planWarnedAt || +now - +g.planWarnedAt > 2 * DAY)) {
      await notifyLeaders(String(g._id), 'SUBSCRIPTION', 'Your plan ends soon', `${g.name} has ${plan.daysLeft} day(s) left on its ${plan.state === 'PRO' ? 'Pro plan' : 'free trial'}. Upgrade to keep it running.`);
      g.planWarnedAt = now;
      await g.save();
    }
    const due = g.dueDayOfMonth ?? 5, day = now.getUTCDate();
    if (day < due - 3) continue;
    const late = day > due;
    const rows: any[] = await Payment.find({
      group: g._id, period: thisMonth, status: { $in: ['PENDING', 'OVERDUE', 'REJECTED'] },
      $or: [{ remindedAt: null }, { remindedAt: { $lt: new Date(+now - 3 * DAY) } }],
    }).populate('membership', 'user status');
    const amount = `${(g.contributionMinor / 100).toLocaleString('en')} ${g.currency}`;
    for (const p of rows) {
      if (p.membership?.status !== 'ACTIVE') continue;
      await notify(p.membership.user, late ? 'PAYMENT_OVERDUE' : 'CONTRIBUTION_REMINDER',
        late ? 'Your contribution is overdue' : 'Contribution reminder',
        late ? `Your ${amount} contribution to ${g.name} was due on day ${due}. Please pay and upload your receipt.` : `Your ${amount} contribution to ${g.name} is due on day ${due} of this month.`);
      p.remindedAt = now;
      await p.save();
    }
  }
}

export function startReminderJob() {
  if (env.REMINDERS_ENABLED !== 'true') return;
  const run = () => runReminders().catch((e) => console.error('Reminder job failed:', e));
  setTimeout(run, 30_000);
  setInterval(run, 6 * 60 * 60 * 1000);
}
