import { Router } from 'express';
import { z } from 'zod';
import { AuditLog, BillingPayment, EqubGroup, Invite, Membership, Notification, Payment, Receipt, RefreshToken, User } from '../../models/index.js';
import { audit } from '../../lib/audit.js';
import { notifyLeaders } from '../../lib/notify.js';
import { planOf } from '../../lib/plan.js';
import { hashToken } from '../../lib/tokens.js';
import { storage } from '../../lib/storage.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { requireAuth, requireSuperAdmin } from '../../middleware/auth.js';

export const miscRouter = Router();
miscRouter.use(requireAuth);

miscRouter.get('/notifications', async (req, res, next) => {
  try {
    const items = await Notification.find({ user: req.user!.id }).sort({ createdAt: -1 }).limit(30);
    res.json({ items, unread: items.filter((n) => !n.readAt).length });
  } catch (e) { next(e); }
});
miscRouter.post('/notifications/read-all', async (req, res, next) => {
  try { await Notification.updateMany({ user: req.user!.id, readAt: null }, { readAt: new Date() }); res.json({ ok: true }); } catch (e) { next(e); }
});

/** Receipts are private: only the uploader, the group's leaders, or a Super Admin may view them. */
miscRouter.get('/receipts/:id', async (req, res, next) => {
  try {
    const r = await Receipt.findById(req.params.id);
    if (!r) throw notFound();
    const p: any = await Payment.findById(r.payment).populate('membership', 'user');
    if (!p) throw notFound();
    const u = req.user!, own = String(p.membership.user) === u.id;
    const lead = u.platformRole === 'SUPER_ADMIN' || !!(await Membership.exists({ user: u.id, group: p.group, role: 'LEADER', status: 'ACTIVE' }));
    if (!own && !lead) throw forbidden();
    res.setHeader('Content-Type', r.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(await storage.get(r.storageKey));
  } catch (e) { next(e); }
});

miscRouter.get('/stats', requireSuperAdmin, async (_req, res, next) => {
  try {
    const [groups, members, proGroups, pendingBilling, by, monthly] = await Promise.all([
      EqubGroup.countDocuments(), Membership.countDocuments({ status: 'ACTIVE' }),
      EqubGroup.countDocuments({ proUntil: { $gt: new Date() } }), BillingPayment.countDocuments({ status: 'SUBMITTED' }),
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, expectedMinor: { $sum: '$expectedMinor' }, paidMinor: { $sum: { $ifNull: ['$paidMinor', 0] } } } }]),
      Payment.aggregate([{ $match: { status: 'VERIFIED' } }, { $group: { _id: '$period', paidMinor: { $sum: '$paidMinor' } } }, { $sort: { _id: -1 } }, { $limit: 6 }]),
    ]);
    res.json({ monthly: monthly.reverse().map((m) => ({ period: new Date(m._id).toISOString().slice(0, 7), paidMinor: m.paidMinor })), groups, members, proGroups, pendingBilling, byStatus: by.map((s) => ({ status: s._id, count: s.count, expectedMinor: s.expectedMinor, paidMinor: s.paidMinor })) });
  } catch (e) { next(e); }
});

miscRouter.get('/audit', requireSuperAdmin, async (_req, res, next) => {
  try { res.json({ items: await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actor', 'fullName') }); } catch (e) { next(e); }
});

/** Profile photos: visible to the person, Super Admins, and leaders of a group the person belongs to. */
miscRouter.get('/users/:id/photo', async (req, res, next) => {
  try {
    const target: any = await User.findById(req.params.id).select('photoKey photoMime');
    if (!target?.photoKey) throw notFound();
    const u = req.user!;
    let ok = u.platformRole === 'SUPER_ADMIN' || String(target._id) === u.id;
    if (!ok) {
      const groups = await Membership.find({ user: target._id, status: { $ne: 'REMOVED' } }).distinct('group');
      ok = !!(await Membership.exists({ user: u.id, role: 'LEADER', status: 'ACTIVE', group: { $in: groups } }));
    }
    if (!ok) throw forbidden();
    res.setHeader('Content-Type', target.photoMime ?? 'image/jpeg');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(await storage.get(target.photoKey));
  } catch (e) { next(e); }
});

// ---- Super Admin: users ----------------------------------------------------
const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
miscRouter.get('/admin/users', requireSuperAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim().slice(0, 60);
    const rows = await User.find(q ? { $or: [{ email: new RegExp(esc(q), 'i') }, { fullName: new RegExp(esc(q), 'i') }] } : {}).sort({ createdAt: -1 }).limit(50);
    res.json({ users: rows.map((u: any) => ({ id: String(u._id), fullName: u.fullName, email: u.email, phone: u.phone ?? null, platformRole: u.platformRole, status: u.status, emailVerified: !!u.emailVerifiedAt, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null })) });
  } catch (e) { next(e); }
});
miscRouter.patch('/admin/users/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).parse(req.body);
    if (req.params.id === req.user!.id) throw conflict('You cannot suspend your own account.');
    const u = await User.findByIdAndUpdate(req.params.id, { status });
    if (!u) throw notFound();
    if (status === 'SUSPENDED') await RefreshToken.updateMany({ user: u._id, revokedAt: null }, { revokedAt: new Date() }); // sign them out everywhere
    await audit({ actorId: req.user!.id, action: `user.${status.toLowerCase()}`, entityType: 'User', entityId: String(u._id), ip: req.ip });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Invite links ----------------------------------------------------------
async function loadInvite(token: string) {
  const inv: any = await Invite.findOne({ tokenHash: hashToken(token) }).populate('group');
  if (!inv || inv.revokedAt || inv.expiresAt < new Date() || inv.uses >= inv.maxUses || !inv.group || inv.group.status !== 'ACTIVE' || !planOf(inv.group).active) throw notFound('This invite link is invalid or has expired. Ask your leader for a new one.');
  return inv;
}
miscRouter.get('/invites/:token', async (req, res, next) => {
  try { const inv = await loadInvite(req.params.token); res.json({ group: { name: inv.group.name, description: inv.group.description ?? null, contributionMinor: inv.group.contributionMinor, currency: inv.group.currency } }); } catch (e) { next(e); }
});
miscRouter.post('/invites/:token/accept', async (req, res, next) => {
  try {
    const inv = await loadInvite(req.params.token), groupId = String(inv.group._id), u = req.user!;
    const existing = await Membership.findOne({ user: u.id, group: groupId });
    if (existing?.status === 'ACTIVE') return res.json({ groupId, already: true });
    if (existing?.status === 'SUSPENDED') throw forbidden('Your membership is suspended. Contact the group leader.');
    if ((await Membership.countDocuments({ group: groupId, status: 'ACTIVE' })) >= inv.group.maxMembers) throw conflict('This Equb is full.');
    const used = await Invite.findOneAndUpdate({ _id: inv._id, $expr: { $lt: ['$uses', '$maxUses'] } }, { $inc: { uses: 1 } });
    if (!used) throw notFound('This invite link has been used up.');
    if (existing) { existing.status = 'ACTIVE'; existing.joinedAt = existing.joinedAt ?? new Date(); await existing.save(); }
    else await Membership.create({ user: u.id, group: groupId, status: 'ACTIVE', joinedAt: new Date() });
    await notifyLeaders(groupId, 'MEMBERSHIP_APPROVED', 'New member joined', `Someone joined ${inv.group.name} with your invite link.`);
    await audit({ actorId: u.id, groupId, action: 'invite.accept', ip: req.ip });
    res.json({ groupId });
  } catch (e) { next(e); }
});

// Super Admin can give a group extra free-trial days (useful for groups created before a policy change).
miscRouter.post('/admin/groups/:id/extend-trial', requireSuperAdmin, async (req, res, next) => {
  try {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(365) }).parse(req.body);
    const g: any = await EqubGroup.findById(req.params.id);
    if (!g) throw notFound();
    g.trialEndsAt = new Date(Math.max(Date.now(), g.trialEndsAt ? +new Date(g.trialEndsAt) : 0) + days * 86_400_000);
    await g.save();
    await notifyLeaders(String(g._id), 'SUBSCRIPTION', 'Free trial extended', `${g.name} now has ${days} more day(s) of free trial.`);
    await audit({ actorId: req.user!.id, groupId: String(g._id), action: 'group.extend_trial', metadata: { days }, ip: req.ip });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
