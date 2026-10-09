import type { Request, RequestHandler } from 'express';
import { Membership, User } from '../models/index.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export const ACCESS_COOKIE = 'eh_access';
export const REFRESH_COOKIE = 'eh_refresh';

declare global {
  namespace Express {
    interface Request { user?: { id: string; platformRole: 'USER' | 'SUPER_ADMIN' } }
  }
}

/** Requires a valid access token and an active account (re-checked in DB so suspensions apply immediately). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw unauthorized();
    let payload;
    try { payload = verifyAccessToken(token); } catch { throw unauthorized('Your session has expired.'); }
    const user = await User.findById(payload.sub).select('platformRole status');
    if (!user || user.status !== 'ACTIVE') throw unauthorized();
    req.user = { id: String(user._id), platformRole: user.platformRole as 'USER' | 'SUPER_ADMIN' };
    next();
  } catch (e) { next(e); }
};

export const requireSuperAdmin: RequestHandler = (req, _res, next) =>
  req.user?.platformRole === 'SUPER_ADMIN' ? next() : next(forbidden());

/**
 * Group-scoped guard. Reads :groupId from the route.
 * LEADER routes: only the group's leaders (or Super Admin). MEMBER routes: any active member (or Super Admin).
 */
export const requireGroupRole = (min: 'MEMBER' | 'LEADER'): RequestHandler => async (req, _res, next) => {
  try {
    if (!req.user) throw unauthorized();
    if (req.user.platformRole === 'SUPER_ADMIN') return next();
    const m = await Membership.findOne({ user: req.user.id, group: req.params.groupId }).select('role status');
    if (!m || m.status !== 'ACTIVE') throw forbidden();
    if (min === 'LEADER' && m.role !== 'LEADER') throw forbidden();
    next();
  } catch (e) { next(e); }
};

export const clientIp = (req: Request) => req.ip ?? undefined;
