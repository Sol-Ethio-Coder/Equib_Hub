import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from './lib/db.js';
import { Announcement, AuditLog, BillingPayment, AuthToken, EqubGroup, Membership, Notification, Payment, Receipt, RefreshToken, User } from './models/index.js';

const PASSWORD = 'Demo@12345';
const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const monthStart = (offset: number) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)); };
type Status = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'OVERDUE';

async function main() {
  await connectDb();
  await Promise.all([Announcement, AuditLog, BillingPayment, AuthToken, Membership, Notification, Payment, Receipt, RefreshToken, EqubGroup, User].map((m: any) => m.deleteMany({})));
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const mk = (fullName: string, email: string, phone: string, platformRole = 'USER') =>
    User.create({ fullName, email, phone, passwordHash, platformRole, emailVerifiedAt: new Date() });

  await mk('Platform Admin', 'admin@equibhub.test', '+251900000001', 'SUPER_ADMIN');
  const abebe = await mk('Abebe Demo', 'leader1@equibhub.test', '+251911000001');
  const hanna = await mk('Hanna Demo', 'leader2@equibhub.test', '+251911000002');
  const names = ['Dawit', 'Selam', 'Mulu', 'Kidus', 'Rahel', 'Samuel', 'Tigist', 'Yonas', 'Betty', 'Nati'];
  const people = [];
  for (const [i, n] of names.entries()) people.push(await mk(`${n} Demo`, `member${i + 1}@equibhub.test`, `+25192200${String(i + 1).padStart(4, '0')}`));

  const g1 = await EqubGroup.create({ name: 'Office Monthly Equb', slug: 'office-monthly', description: 'Demo workplace Equb — monthly contribution.', contributionMinor: 500_000, startDate: monthStart(-2), maxMembers: 10, status: 'ACTIVE', trialEndsAt: days(-30), proUntil: days(25) }); // paid Pro
  const g2 = await EqubGroup.create({ name: 'Neighbours Equb', slug: 'neighbours', description: 'Demo neighbourhood Equb.', contributionMinor: 200_000, startDate: monthStart(-1), maxMembers: 6, status: 'ACTIVE', trialEndsAt: days(5) }); // on free trial
  const g3 = await EqubGroup.create({ name: 'Expired Demo Equb', slug: 'expired-demo', description: 'Demo of a paused group: trial ended, no Pro plan.', contributionMinor: 100_000, startDate: monthStart(-1), maxMembers: 5, status: 'ACTIVE', trialEndsAt: days(-2) });

  const join = (user: any, group: any, role = 'MEMBER', status = 'ACTIVE') =>
    Membership.create({ user: user._id, group: group._id, role, status, joinedAt: status === 'ACTIVE' ? new Date() : undefined });
  const lead1 = await join(abebe, g1, 'LEADER'), lead2 = await join(hanna, g2, 'LEADER');
  const g1Members = [lead1]; for (const p of people.slice(0, 7)) g1Members.push(await join(p, g1));
  const g2Members = [lead2]; for (const p of people.slice(5, 9)) g2Members.push(await join(p, g2)); // some people are in both groups
  await join(people[9], g1, 'MEMBER', 'PENDING');
  await join(abebe, g3, 'LEADER'); await join(people[0], g3); await join(people[1], g3);

  const pattern: Status[] = ['VERIFIED', 'VERIFIED', 'SUBMITTED', 'PENDING', 'REJECTED', 'OVERDUE', 'VERIFIED', 'SUBMITTED'];
  const seedPayments = async (members: any[], group: any) => {
    const docs: any[] = [];
    for (const offset of [-2, -1, 0]) {
      if (monthStart(offset) < new Date(Date.UTC(group.startDate.getUTCFullYear(), group.startDate.getUTCMonth(), 1))) continue;
      members.forEach((m, i) => {
        const status: Status = offset < 0 ? (i % 6 === 5 ? 'OVERDUE' : 'VERIFIED') : pattern[i % pattern.length];
        const paid = ['VERIFIED', 'SUBMITTED', 'REJECTED'].includes(status);
        docs.push({
          membership: m._id, group: group._id, period: monthStart(offset), expectedMinor: group.contributionMinor, status,
          paidMinor: paid ? group.contributionMinor : undefined, paidAt: paid ? new Date() : undefined, method: paid ? 'TELEBIRR' : undefined,
          verifiedAt: status === 'VERIFIED' ? new Date() : undefined,
          rejectionReason: status === 'REJECTED' ? 'Receipt is unclear. Please upload a sharper screenshot.' : undefined,
        });
      });
    }
    await Payment.insertMany(docs);
  };
  await seedPayments(g1Members, g1);
  await seedPayments(g2Members, g2);
  await Announcement.create({ group: g1._id, author: abebe._id, title: 'Welcome to our Equb', body: 'Please pay before the 5th of each month and upload your receipt.' });

  console.log(`\nSeeded demo data. Password for every demo account: ${PASSWORD}\n  Super Admin : admin@equibhub.test\n  Plans       : Office = Pro, Neighbours = free trial (5 days left), Expired Demo = paused (leader1 can upgrade it)
  Leaders     : leader1@equibhub.test, leader2@equibhub.test\n  Members     : member1@equibhub.test … member10@equibhub.test\n`);
  await disconnectDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
