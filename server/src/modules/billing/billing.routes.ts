import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { BillingPayment, EqubGroup, Membership, User } from '../../models/index.js';
import { env } from '../../config/env.js';
import { audit } from '../../lib/audit.js';
import { notify } from '../../lib/notify.js';
import { planOf } from '../../lib/plan.js';
import { sniff, storage } from '../../lib/storage.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { clientIp, requireAuth, requireGroupRole, requireSuperAdmin } from '../../middleware/auth.js';

export const billingRouter = Router();
billingRouter.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const wrap = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);
const sid = (v: unknown) => String(v);
const PRICE_MINOR = () => Math.round(env.PRO_PRICE_ETB * 100);

billingRouter.get('/info', wrap(async (_req, res) => {
  res.json({ priceMinor: PRICE_MINOR(), currency: 'ETB', trialDays: env.TRIAL_DAYS, instructions: env.BILLING_INSTRUCTIONS });
}));

// ---- Leader: view plan + history, submit a Pro payment ----------------------
billingRouter.get('/groups/:groupId', requireGroupRole('LEADER'), wrap(async (req, res) => {
  const group = await EqubGroup.findById(req.params.groupId);
  if (!group) throw notFound();
  const items = await BillingPayment.find({ group: group._id }).sort({ createdAt: -1 }).limit(24);
  res.json({
    group: { id: sid(group._id), name: group.name }, plan: planOf(group),
    items: items.map((b) => ({ id: sid(b._id), months: b.months, amountMinor: b.amountMinor, currency: b.currency, method: b.method, status: b.status, rejectionReason: b.rejectionReason ?? null, createdAt: (b as any).createdAt })),
  });
}));

billingRouter.post('/groups/:groupId/pay', requireGroupRole('LEADER'), upload.single('file'), wrap(async (req, res) => {
  const body = z.object({ months: z.coerce.number().refine((m) => [1, 3, 6, 12].includes(m), 'Choose 1, 3, 6 or 12 months.'), method: z.enum(['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CASH', 'OTHER']) }).parse(req.body);
  if (!req.file) throw badRequest('Upload your payment receipt (JPG, PNG, WebP or PDF, max 5 MB).');
  const kind = sniff(req.file.buffer);
  if (!kind) throw badRequest('Unsupported file. Upload a JPG, PNG, WebP or PDF.');
  const group = await EqubGroup.findById(req.params.groupId);
  if (!group) throw notFound();
  if (await BillingPayment.exists({ group: group._id, status: 'SUBMITTED' })) throw conflict('You already have a payment waiting for review.');
  const key = await storage.put(req.file.buffer, kind.ext);
  const b = await BillingPayment.create({ group: group._id, submittedBy: req.user.id, months: body.months, amountMinor: PRICE_MINOR() * body.months, method: body.method, storageKey: key, mimeType: kind.mime, sizeBytes: req.file.size });
  const admins = await User.find({ platformRole: 'SUPER_ADMIN', status: 'ACTIVE' }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, 'SUBSCRIPTION', 'Pro payment to review', `${group.name} submitted a Pro payment for ${body.months} month(s).`)));
  await audit({ actorId: req.user.id, groupId: sid(group._id), action: 'billing.submit', entityType: 'BillingPayment', entityId: sid(b._id), ip: clientIp(req) });
  res.status(201).json({ ok: true });
}));

// ---- Super Admin: review Pro payments ---------------------------------------
billingRouter.get('/admin/pending', requireSuperAdmin, wrap(async (_req, res) => {
  const rows: any[] = await BillingPayment.find({ status: 'SUBMITTED' }).sort({ createdAt: 1 }).populate('group', 'name').populate('submittedBy', 'fullName email');
  res.json({ items: rows.map((b) => ({ id: sid(b._id), group: b.group?.name ?? 'Deleted group', by: b.submittedBy?.fullName ?? '', email: b.submittedBy?.email ?? '', months: b.months, amountMinor: b.amountMinor, currency: b.currency, method: b.method, createdAt: b.createdAt })) });
}));

billingRouter.post('/admin/:id/approve', requireSuperAdmin, wrap(async (req, res) => {
  const b: any = await BillingPayment.findById(req.params.id).populate('group');
  if (!b || !b.group) throw notFound();
  if (b.status !== 'SUBMITTED') throw conflict('This payment was already reviewed.');
  const g = b.group;
  // Extend from the latest of: now, current Pro end, trial end (so remaining trial days are not lost).
  const base = Math.max(Date.now(), g.proUntil ? +new Date(g.proUntil) : 0, g.trialEndsAt ? +new Date(g.trialEndsAt) : 0);
  g.proUntil = new Date(base + b.months * 30 * 86_400_000);
  await g.save();
  Object.assign(b, { status: 'VERIFIED', reviewedBy: req.user.id, reviewedAt: new Date() });
  await b.save();
  await notify(b.submittedBy, 'SUBSCRIPTION', 'Pro plan activated', `${g.name} is on Pro until ${g.proUntil.toISOString().slice(0, 10)}. Thank you!`);
  await audit({ actorId: req.user.id, groupId: sid(g._id), action: 'billing.approve', entityType: 'BillingPayment', entityId: sid(b._id), ip: clientIp(req) });
  res.json({ ok: true });
}));

billingRouter.post('/admin/:id/reject', requireSuperAdmin, wrap(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3, 'Add a reason.').max(300) }).parse(req.body);
  const b: any = await BillingPayment.findById(req.params.id);
  if (!b) throw notFound();
  if (b.status !== 'SUBMITTED') throw conflict('This payment was already reviewed.');
  Object.assign(b, { status: 'REJECTED', rejectionReason: reason, reviewedBy: req.user.id, reviewedAt: new Date() });
  await b.save();
  await notify(b.submittedBy, 'SUBSCRIPTION', 'Pro payment rejected', `Your payment was rejected: ${reason}`);
  await audit({ actorId: req.user.id, groupId: sid(b.group), action: 'billing.reject', entityType: 'BillingPayment', entityId: sid(b._id), ip: clientIp(req) });
  res.json({ ok: true });
}));

/** Billing receipts: Super Admin, or the leader who submitted it. */
billingRouter.get('/receipt/:id', wrap(async (req, res) => {
  const b: any = await BillingPayment.findById(req.params.id);
  if (!b) throw notFound();
  const u = req.user;
  const ok = u.platformRole === 'SUPER_ADMIN' || (sid(b.submittedBy) === u.id && !!(await Membership.exists({ user: u.id, group: b.group, role: 'LEADER', status: 'ACTIVE' })));
  if (!ok) throw forbidden();
  res.setHeader('Content-Type', b.mimeType ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(await storage.get(b.storageKey));
}));
