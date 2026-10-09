import type { RequestHandler } from 'express';
import { EqubGroup } from '../models/index.js';
import { AppError, notFound } from '../lib/errors.js';
import { planOf } from '../lib/plan.js';

/** Blocks group features when the free trial and Pro plan have both ended. Super Admins are exempt. */
export const requireActivePlan: RequestHandler = async (req, _res, next) => {
  try {
    if (req.user?.platformRole === 'SUPER_ADMIN') return next();
    const g = await EqubGroup.findById(req.params.groupId).select('trialEndsAt proUntil');
    if (!g) throw notFound();
    if (!planOf(g).active) throw new AppError(402, 'This Equb is paused because its free trial or Pro plan has ended. The group leader can upgrade to continue.', 'plan_expired');
    next();
  } catch (e) { next(e); }
};
