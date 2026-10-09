import { Router, Response, CookieOptions } from 'express';
import multer from 'multer';
import { isImage, sniff } from '../../lib/filetype.js';
import { storage } from '../../lib/storage.js';
import rateLimit from 'express-rate-limit';
import { Membership, User } from '../../models/index.js';
import { env, isProd } from '../../config/env.js';
import { ACCESS_COOKIE, REFRESH_COOKIE, clientIp, requireAuth } from '../../middleware/auth.js';
import { badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { planOf } from '../../lib/plan.js';
import * as svc from './auth.service.js';
import { changePasswordSchema, forgotSchema, loginSchema, profileSchema, registerSchema, resetSchema, verifySchema } from './auth.schemas.js';

export const authRouter = Router();

const limiter = (max: number) => rateLimit({
  windowMs: 15 * 60_000, max, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

const base: CookieOptions = { httpOnly: true, secure: isProd, sameSite: 'lax' };
function setCookies(res: Response, s: { access: string; refresh: string }) {
  res.cookie(ACCESS_COOKIE, s.access, { ...base, path: '/', maxAge: env.ACCESS_TOKEN_TTL_MIN * 60_000 });
  // The refresh cookie is only sent to the auth endpoints.
  res.cookie(REFRESH_COOKIE, s.refresh, { ...base, path: '/api/auth', maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
}
const clearCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
};
const meta = (req: any) => ({ ip: clientIp(req), userAgent: req.get('user-agent') as string | undefined });

authRouter.post('/register', limiter(10), async (req, res, next) => {
  try {
    const { user, session } = await svc.register(registerSchema.parse(req.body), meta(req));
    setCookies(res, session);
    res.status(201).json({ user: svc.publicUser(user) });
  } catch (e) { next(e); }
});

authRouter.post('/login', limiter(10), async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, session } = await svc.login(email, password, meta(req));
    setCookies(res, session);
    res.json({ user: svc.publicUser(user) });
  } catch (e) { next(e); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw unauthorized();
    const { user, session } = await svc.refresh(raw, meta(req));
    setCookies(res, session);
    res.json({ user: svc.publicUser(user) });
  } catch (e) { if ((e as { code?: string }).code !== 'refresh_race') clearCookies(res); next(e); }
});

authRouter.post('/logout', async (req, res, next) => {
  try { await svc.logout(req.cookies?.[REFRESH_COOKIE]); clearCookies(res); res.status(204).end(); } catch (e) { next(e); }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) throw unauthorized();
    const memberships = await Membership.find({ user: user._id, status: { $in: ['ACTIVE', 'PENDING'] } }).populate('group', 'name slug status trialEndsAt proUntil');
    res.json({
      user: svc.publicUser(user),
      memberships: memberships.map((m: any) => ({ id: String(m._id), role: m.role, status: m.status, group: { id: String(m.group._id), name: m.group.name, slug: m.group.slug, status: m.group.status, plan: planOf(m.group) } })),
    });
  } catch (e) { next(e); }
});

authRouter.post('/forgot-password', limiter(5), async (req, res, next) => {
  try {
    await svc.forgotPassword(forgotSchema.parse(req.body).email);
    res.json({ message: 'If an account exists for that email, a reset link is on its way.' });
  } catch (e) { next(e); }
});

authRouter.post('/reset-password', limiter(10), async (req, res, next) => {
  try {
    const { token, password } = resetSchema.parse(req.body);
    await svc.resetPassword(token, password, clientIp(req));
    clearCookies(res);
    res.json({ message: 'Password updated. Please sign in.' });
  } catch (e) { next(e); }
});

authRouter.post('/verify-email', limiter(20), async (req, res, next) => {
  try { await svc.verifyEmail(verifySchema.parse(req.body).token); res.json({ message: 'Email verified.' }); } catch (e) { next(e); }
});

authRouter.post('/resend-verification', requireAuth, limiter(5), async (req, res, next) => {
  try { await svc.resendVerification(req.user!.id); res.json({ message: 'Verification email sent.' }); } catch (e) { next(e); }
});

const PROFILE_KEYS = ['fullName', 'phone', 'gender', 'address', 'emergencyName', 'emergencyPhone'] as const;
authRouter.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const d: any = profileSchema.parse(req.body);
    const set: Record<string, unknown> = {}, unset: Record<string, 1> = {};
    for (const k of PROFILE_KEYS) {
      if (!(k in req.body)) continue;
      if (d[k] === undefined) { if (k !== 'fullName') unset[k] = 1; } else set[k] = d[k];
    }
    if (set.phone && (await User.exists({ phone: set.phone, _id: { $ne: req.user!.id } }))) throw conflict('That phone number is already used by another account.');
    const user = await User.findByIdAndUpdate(req.user!.id, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true });
    res.json({ user: svc.publicUser(user) });
  } catch (e) { next(e); }
});

authRouter.post('/change-password', requireAuth, limiter(10), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    setCookies(res, await svc.changePassword(req.user!.id, currentPassword, newPassword, meta(req)));
    res.json({ message: 'Password updated.' });
  } catch (e) { next(e); }
});

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
authRouter.post('/profile/photo', requireAuth, photoUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest('Choose a photo (JPG, PNG or WebP, max 2 MB).');
    const kind = sniff(req.file.buffer);
    if (!kind || !isImage(kind.mime)) throw badRequest('Photos must be JPG, PNG or WebP.');
    const key = await storage.put(req.file.buffer, kind.ext);
    const user = await User.findByIdAndUpdate(req.user!.id, { photoKey: key, photoMime: kind.mime }, { new: true });
    res.json({ user: svc.publicUser(user) });
  } catch (e) { next(e); }
});
