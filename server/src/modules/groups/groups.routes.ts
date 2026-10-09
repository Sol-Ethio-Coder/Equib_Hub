import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Announcement, Invite, Membership, Payment, Receipt, EqubGroup, User } from '../../models/index.js';
import { audit } from '../../lib/audit.js';
import { notify, notifyLeaders } from '../../lib/notify.js';
import { sniff, storage } from '../../lib/storage.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { clientIp, requireAuth, requireGroupRole } from '../../middleware/auth.js';
import { requireActivePlan as active } from '../../middleware/plan.js';
import { planOf } from '../../lib/plan.js';
import { hashToken, newOpaqueToken } from '../../lib/tokens.js';
import { sendTable, Table } from './reports.js';
import { env } from '../../config/env.js';

export const groupsRouter = Router();
groupsRouter.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const wrap = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);
const leader = requireGroupRole('LEADER'), member = requireGroupRole('MEMBER');
const sid = (v: unknown) => String(v);

const parsePeriod = (s?: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? '');
  const n = new Date();
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
};
const isLeader = async (req: any, groupId: string) =>
  req.user.platformRole === 'SUPER_ADMIN' || !!(await Membership.exists({ user: req.user.id, group: groupId, role: 'LEADER', status: 'ACTIVE' }));

// ---- Groups -------------------------------------------------------------
groupsRouter.get('/', wrap(async (req, res) => {
  const admin = req.user.platformRole === 'SUPER_ADMIN';
  const all = await EqubGroup.find(admin ? {} : { status: 'ACTIVE' }).sort({ name: 1 });
  const groups = all.filter((g) => admin || planOf(g).active); // paused groups are hidden from the join list
  const counts = await Membership.aggregate([{ $match: { status: 'ACTIVE', group: { $in: groups.map((g) => g._id) } } }, { $group: { _id: '$group', n: { $sum: 1 } } }]);
  const byGroup = new Map(counts.map((c) => [sid(c._id), c.n as number]));
  res.json({ groups: groups.map((g) => ({ ...g.toJSON(), plan: planOf(g), _count: { memberships: byGroup.get(sid(g._id)) ?? 0 } })) });
}));

const createSchema = z.object({
  name: z.string().trim().min(3).max(80), description: z.string().trim().max(500).optional(),
  contributionAmount: z.coerce.number().positive().max(10_000_000), maxMembers: z.coerce.number().int().min(2).max(500),
  leaderEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
});
groupsRouter.post('/', wrap(async (req, res) => {
  const d = createSchema.parse(req.body);
  const admin = req.user.platformRole === 'SUPER_ADMIN';
  const leaderUser = admin && d.leaderEmail ? await User.findOne({ email: d.leaderEmail }) : null;
  if (admin && d.leaderEmail && !leaderUser) throw badRequest('No account found for that leader email. Ask them to sign up first.');
  // One free trial per person: later groups created by the same user start without a trial.
  const usedTrial = !admin && !!(await EqubGroup.exists({ createdBy: req.user.id }));
  const trialEndsAt = new Date(Date.now() + (usedTrial ? 0 : env.TRIAL_DAYS) * 86_400_000);
  const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  const group = await EqubGroup.create({ name: d.name, slug, description: d.description, contributionMinor: Math.round(d.contributionAmount * 100), maxMembers: d.maxMembers, startDate: parsePeriod(), status: 'ACTIVE', trialEndsAt, createdBy: req.user.id });
  const leaderId = leaderUser?._id ?? (admin ? null : req.user.id);
  if (leaderId) await Membership.create({ user: leaderId, group: group._id, role: 'LEADER', status: 'ACTIVE', joinedAt: new Date() });
  await audit({ actorId: req.user.id, groupId: sid(group._id), action: 'group.create', entityType: 'EqubGroup', entityId: sid(group._id), ip: clientIp(req) });
  res.status(201).json({ group, plan: planOf(group) });
}));

groupsRouter.post('/:groupId/join', wrap(async (req, res) => {
  const group = await EqubGroup.findOne({ _id: req.params.groupId, status: 'ACTIVE' });
  if (!group || !planOf(group).active) throw notFound('This Equb is not accepting members.');
  if (await Membership.exists({ user: req.user.id, group: group._id })) throw conflict('You already have a membership or pending request for this Equb.');
  const m = await Membership.create({ user: req.user.id, group: group._id });
  await notifyLeaders(sid(group._id), 'MEMBERSHIP_APPROVED', 'New join request', `A member asked to join ${group.name}.`);
  res.status(201).json({ membership: m });
}));

groupsRouter.get('/:groupId', member, wrap(async (req, res) => {
  const group = await EqubGroup.findById(req.params.groupId);
  if (!group) throw notFound();
  res.json({ group, plan: planOf(group), canManage: await isLeader(req, req.params.groupId) });
}));

// ---- Members ------------------------------------------------------------
groupsRouter.get('/:groupId/members', leader, active, wrap(async (req, res) => {
  const rows: any[] = await Membership.find({ group: req.params.groupId, status: { $ne: 'REMOVED' } }).populate('user', 'fullName email phone photoKey').sort({ status: 1, createdAt: 1 });
  res.json({ members: rows.map((m) => ({ id: sid(m._id), userId: sid(m.user._id), hasPhoto: !!m.user.photoKey, role: m.role, status: m.status, joinedAt: m.joinedAt, user: { fullName: m.user.fullName, email: m.user.email, phone: m.user.phone ?? null } })) });
}));

const actionSchema = z.object({ action: z.enum(['approve', 'suspend', 'reactivate', 'remove', 'make_leader', 'make_member']) });
groupsRouter.patch('/:groupId/members/:membershipId', leader, active, wrap(async (req, res) => {
  const { action } = actionSchema.parse(req.body);
  const m: any = await Membership.findOne({ _id: req.params.membershipId, group: req.params.groupId }).populate('group', 'name');
  if (!m) throw notFound();
  const superAdmin = req.user.platformRole === 'SUPER_ADMIN';
  if ((action === 'make_leader' || action === 'make_member' || m.role === 'LEADER') && !superAdmin) throw forbidden('Only a Super Admin can change leaders.');
  if (action === 'make_leader' && m.status !== 'ACTIVE') throw badRequest('Approve this member first, then make them a leader.');
  if (action === 'make_member' && m.role === 'LEADER' && (await Membership.countDocuments({ group: req.params.groupId, role: 'LEADER', status: 'ACTIVE' })) <= 1) throw conflict('A group needs at least one leader. Make someone else a leader first.');
  if ((action === 'approve' || action === 'reactivate') && m.status !== 'ACTIVE') {
    const g: any = await EqubGroup.findById(req.params.groupId).select('maxMembers');
    if (g && (await Membership.countDocuments({ group: req.params.groupId, status: 'ACTIVE' })) >= g.maxMembers) throw conflict('This Equb is full. Remove a member first.');
  }
  if (action === 'approve' || action === 'reactivate') { m.status = 'ACTIVE'; m.joinedAt = m.joinedAt ?? new Date(); }
  else if (action === 'suspend') m.status = 'SUSPENDED';
  else if (action === 'remove') m.status = 'REMOVED';
  else m.role = action === 'make_leader' ? 'LEADER' : 'MEMBER';
  await m.save();
  if (action === 'make_leader') await notify(m.user, 'MEMBERSHIP_APPROVED', 'You are now a group leader', `You can now manage ${m.group.name}: members, payments and receipts.`);
  if (action === 'approve') await notify(m.user, 'MEMBERSHIP_APPROVED', 'You are in!', `Your request to join ${m.group.name} was approved.`);
  await audit({ actorId: req.user.id, groupId: req.params.groupId, action: `member.${action}`, entityType: 'Membership', entityId: sid(m._id), ip: clientIp(req) });
  res.json({ ok: true });
}));

// ---- Announcements ------------------------------------------------------
groupsRouter.get('/:groupId/announcements', member, active, wrap(async (req, res) => {
  const rows: any[] = await Announcement.find({ group: req.params.groupId }).sort({ createdAt: -1 }).limit(20).populate('author', 'fullName');
  res.json({ items: rows.map((a) => ({ id: sid(a._id), title: a.title, body: a.body, author: a.author?.fullName ?? '', createdAt: a.createdAt })) });
}));
groupsRouter.post('/:groupId/announcements', leader, active, wrap(async (req, res) => {
  const d = z.object({ title: z.string().trim().min(2, 'Add a title.').max(100), body: z.string().trim().min(2, 'Write a message.').max(1000) }).parse(req.body);
  await Announcement.create({ group: req.params.groupId, author: req.user.id, ...d });
  const ms = await Membership.find({ group: req.params.groupId, status: 'ACTIVE', user: { $ne: req.user.id } }).select('user');
  await Promise.all(ms.map((m) => notify(m.user, 'ANNOUNCEMENT', d.title, d.body.slice(0, 140))));
  await audit({ actorId: req.user.id, groupId: req.params.groupId, action: 'announcement.create', ip: clientIp(req) });
  res.status(201).json({ ok: true });
}));

// ---- Payments -----------------------------------------------------------
groupsRouter.get('/:groupId/payments', member, active, wrap(async (req, res) => {
  const { groupId } = req.params, period = parsePeriod(req.query.period as string);
  const canManage = await isLeader(req, groupId);
  await Payment.updateMany({ group: groupId, status: 'PENDING', period: { $lt: parsePeriod() } }, { status: 'OVERDUE' });
  const filter: any = { group: groupId, period };
  if (!canManage) filter.membership = { $in: await Membership.find({ group: groupId, user: req.user.id }).distinct('_id') };
  const rows: any[] = await Payment.find(filter).populate({ path: 'membership', populate: { path: 'user', select: 'fullName email' } });
  const receipts = await Receipt.find({ payment: { $in: rows.map((r) => r._id) } }).sort({ createdAt: -1 }).select('payment');
  const payments = rows.map((p) => ({
    id: sid(p._id), status: p.status, expectedMinor: p.expectedMinor, paidMinor: p.paidMinor ?? null, currency: p.currency, paidAt: p.paidAt, method: p.method ?? null,
    rejectionReason: p.rejectionReason ?? null, verifiedAt: p.verifiedAt,
    membership: { user: { fullName: p.membership.user.fullName, email: p.membership.user.email } },
    receipts: receipts.filter((r) => sid(r.payment) === sid(p._id)).map((r) => ({ id: sid(r._id) })),
  })).sort((a, b) => a.membership.user.fullName.localeCompare(b.membership.user.fullName));
  res.json({ payments, canManage, period: period.toISOString().slice(0, 7) });
}));

groupsRouter.post('/:groupId/payments/generate', leader, active, wrap(async (req, res) => {
  const period = parsePeriod(req.body?.period);
  const group = await EqubGroup.findById(req.params.groupId);
  if (!group) throw notFound();
  const ms = await Membership.find({ group: group._id, status: 'ACTIVE' }).select('_id');
  const ops = ms.map((m) => ({ updateOne: { filter: { membership: m._id, period }, update: { $setOnInsert: { group: group._id, expectedMinor: group.contributionMinor, currency: group.currency, status: 'PENDING' } }, upsert: true } }));
  const r = ops.length ? await Payment.bulkWrite(ops) : { upsertedCount: 0 };
  await audit({ actorId: req.user.id, groupId: sid(group._id), action: 'payments.generate', metadata: { period: period.toISOString(), created: r.upsertedCount }, ip: clientIp(req) });
  res.json({ created: r.upsertedCount });
}));

const methods = ['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const;
groupsRouter.post('/:groupId/payments/:paymentId/receipt', member, active, upload.single('file'), wrap(async (req, res) => {
  const body = z.object({ method: z.enum(methods), amount: z.coerce.number().positive().max(10_000_000) }).parse(req.body);
  if (!req.file) throw badRequest('Choose a receipt image or PDF (max 5 MB).');
  const kind = sniff(req.file.buffer);
  if (!kind) throw badRequest('Unsupported file. Upload a JPG, PNG, WebP or PDF.');
  const mine = await Membership.find({ group: req.params.groupId, user: req.user.id, status: 'ACTIVE' }).distinct('_id');
  const p: any = await Payment.findOne({ _id: req.params.paymentId, group: req.params.groupId, membership: { $in: mine } });
  if (!p) throw notFound('Payment not found.');
  if (!['PENDING', 'OVERDUE', 'REJECTED'].includes(p.status)) throw conflict('This payment is already submitted or verified.');
  const key = await storage.put(req.file.buffer, kind.ext);
  await Receipt.create({ payment: p._id, storageKey: key, mimeType: kind.mime, sizeBytes: req.file.size, uploadedBy: req.user.id });
  Object.assign(p, { status: 'SUBMITTED', paidMinor: Math.round(body.amount * 100), paidAt: new Date(), method: body.method, rejectionReason: undefined });
  await p.save();
  const who = await User.findById(req.user.id).select('fullName');
  await notifyLeaders(req.params.groupId, 'RECEIPT_SUBMITTED', 'Receipt submitted', `${who?.fullName ?? 'A member'} submitted a receipt.`);
  res.status(201).json({ ok: true });
}));

const review = (verify: boolean) => wrap(async (req, res) => {
  const reason = verify ? undefined : z.object({ reason: z.string().trim().min(3, 'Add a reason so the member knows what to fix.').max(300) }).parse(req.body).reason;
  const p: any = await Payment.findOne({ _id: req.params.paymentId, group: req.params.groupId }).populate('membership', 'user');
  if (!p) throw notFound();
  if (p.status !== 'SUBMITTED') throw conflict('Only submitted payments can be reviewed.');
  if (sid(p.membership.user) === req.user.id && req.user.platformRole !== 'SUPER_ADMIN') throw forbidden('You cannot verify your own payment.');
  Object.assign(p, verify ? { status: 'VERIFIED', verifiedBy: req.user.id, verifiedAt: new Date() } : { status: 'REJECTED', rejectionReason: reason, verifiedBy: req.user.id, verifiedAt: new Date() });
  await p.save();
  await notify(p.membership.user, verify ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED', verify ? 'Payment verified' : 'Payment rejected', verify ? 'Your contribution was verified. Thank you!' : `Your receipt was rejected: ${reason}`);
  await audit({ actorId: req.user.id, groupId: req.params.groupId, action: verify ? 'payment.verify' : 'payment.reject', entityType: 'Payment', entityId: sid(p._id), ip: clientIp(req) });
  res.json({ ok: true });
});
groupsRouter.post('/:groupId/payments/:paymentId/verify', leader, active, review(true));
groupsRouter.post('/:groupId/payments/:paymentId/reject', leader, active, review(false));

// ---- Add by email / invite links -----------------------------------------
const hasRoom = async (groupId: string) => {
  const g: any = await EqubGroup.findById(groupId).select('maxMembers');
  return !!g && (await Membership.countDocuments({ group: groupId, status: 'ACTIVE' })) < g.maxMembers;
};
groupsRouter.post('/:groupId/members', leader, active, wrap(async (req, res) => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.') }).parse(req.body);
  const user = await User.findOne({ email });
  if (!user) throw badRequest('No account found for that email. Send them an invite link instead.');
  const group: any = await EqubGroup.findById(req.params.groupId).select('name');
  const existing = await Membership.findOne({ user: user._id, group: req.params.groupId });
  if (existing?.status === 'ACTIVE') throw conflict('That person is already a member.');
  if (!(await hasRoom(req.params.groupId))) throw conflict('This Equb is full. Remove a member first.');
  if (existing) { existing.status = 'ACTIVE'; existing.joinedAt = existing.joinedAt ?? new Date(); await existing.save(); }
  else await Membership.create({ user: user._id, group: req.params.groupId, status: 'ACTIVE', joinedAt: new Date() });
  await notify(user._id, 'MEMBERSHIP_APPROVED', 'You were added to an Equb', `You are now a member of ${group.name}.`);
  await audit({ actorId: req.user.id, groupId: req.params.groupId, action: 'member.add', entityType: 'User', entityId: sid(user._id), ip: clientIp(req) });
  res.status(201).json({ ok: true });
}));

groupsRouter.post('/:groupId/invites', leader, active, wrap(async (req, res) => {
  const token = newOpaqueToken();
  await Invite.create({ group: req.params.groupId, createdBy: req.user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86_400_000), maxUses: 20 });
  await audit({ actorId: req.user.id, groupId: req.params.groupId, action: 'invite.create', ip: clientIp(req) });
  res.status(201).json({ link: `${env.CLIENT_URL}/join/${token}`, expiresInDays: 7, maxUses: 20 });
}));

// ---- Reports (CSV + PDF) ------------------------------------------------
const m2 = (v?: number | null) => (v == null ? '' : (v / 100).toFixed(2));
const day = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
groupsRouter.get('/:groupId/reports/:type.:fmt', member, active, wrap(async (req, res) => {
  const { groupId, type, fmt } = req.params as Record<string, string>;
  if (fmt !== 'csv' && fmt !== 'pdf') throw notFound();
  const group: any = await EqubGroup.findById(groupId);
  if (!group) throw notFound();
  const canManage = await isLeader(req, groupId), cur = group.currency;
  const period = parsePeriod(req.query.period as string), pl = period.toISOString().slice(0, 7);
  const people = { path: 'membership', populate: { path: 'user', select: 'fullName email' } };
  let t: Table;

  if (type === 'history') {
    let membershipId = req.query.membership as string | undefined;
    if (!canManage) { // members may only download their own history
      const mine = await Membership.findOne({ group: groupId, user: req.user.id, status: 'ACTIVE' }).select('_id');
      if (!mine) throw forbidden();
      membershipId = sid(mine._id);
    }
    if (!membershipId) throw badRequest('Choose a member.');
    const ms: any = await Membership.findOne({ _id: membershipId, group: groupId }).populate('user', 'fullName email');
    if (!ms) throw notFound();
    const rows: any[] = await Payment.find({ membership: ms._id }).sort({ period: -1 });
    t = { filename: `history-${ms.user.fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, title: `Payment history: ${ms.user.fullName}`, subtitle: group.name,
      columns: ['Month', `Expected (${cur})`, `Paid (${cur})`, 'Status', 'Paid on', 'Method', 'Note'],
      rows: rows.map((p) => [new Date(p.period).toISOString().slice(0, 7), m2(p.expectedMinor), m2(p.paidMinor), p.status, day(p.paidAt), p.method ?? '', p.rejectionReason ?? '']) };
  } else {
    if (!canManage) throw forbidden();
    if (type === 'monthly' || type === 'outstanding') {
      const filter: any = { group: groupId, period, ...(type === 'outstanding' ? { status: { $ne: 'VERIFIED' } } : {}) };
      const rows: any[] = await Payment.find(filter).populate(people);
      rows.sort((a, b) => a.membership.user.fullName.localeCompare(b.membership.user.fullName));
      t = type === 'monthly'
        ? { filename: `contributions-${pl}`, title: `Monthly contributions · ${pl}`, subtitle: group.name, columns: ['Member', 'Email', `Expected (${cur})`, `Paid (${cur})`, 'Status', 'Paid on', 'Method'],
            rows: rows.map((p) => [p.membership.user.fullName, p.membership.user.email, m2(p.expectedMinor), m2(p.paidMinor), p.status, day(p.paidAt), p.method ?? '']) }
        : { filename: `outstanding-${pl}`, title: `Outstanding payments · ${pl}`, subtitle: group.name, columns: ['Member', 'Email', `Expected (${cur})`, 'Status', 'Note'],
            rows: rows.map((p) => [p.membership.user.fullName, p.membership.user.email, m2(p.expectedMinor), p.status, p.rejectionReason ?? '']) };
    } else if (type === 'summary') {
      const agg = await Payment.aggregate([{ $match: { group: new mongoose.Types.ObjectId(groupId) } }, { $group: { _id: { p: '$period', s: '$status' }, n: { $sum: 1 }, expected: { $sum: '$expectedMinor' }, paid: { $sum: { $ifNull: ['$paidMinor', 0] } } } }]);
      const by = new Map<string, { n: number; expected: number; verified: number; review: number; outstanding: number }>();
      for (const a of agg) {
        const k = new Date(a._id.p).toISOString().slice(0, 7), r = by.get(k) ?? { n: 0, expected: 0, verified: 0, review: 0, outstanding: 0 };
        r.n += a.n; r.expected += a.expected;
        if (a._id.s === 'VERIFIED') r.verified += a.paid; else if (a._id.s === 'SUBMITTED') r.review += a.paid; else r.outstanding += a.expected;
        by.set(k, r);
      }
      t = { filename: 'financial-summary', title: 'Group financial summary', subtitle: group.name,
        columns: ['Month', 'Records', `Expected (${cur})`, `Verified (${cur})`, `Awaiting review (${cur})`, `Outstanding (${cur})`, 'Collected'],
        rows: [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, r]) => [k, r.n, m2(r.expected), m2(r.verified), m2(r.review), m2(r.outstanding), r.expected ? `${Math.round((r.verified / r.expected) * 100)}%` : '-']) };
    } else throw notFound();
  }
  await audit({ actorId: req.user.id, groupId, action: `report.${type}.${fmt}`, ip: clientIp(req) });
  sendTable(res, fmt, t);
}));
