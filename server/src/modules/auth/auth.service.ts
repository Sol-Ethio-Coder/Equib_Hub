import bcrypt from 'bcryptjs';
import { AuthToken, Notification, RefreshToken, User } from '../../models/index.js';
import { env } from '../../config/env.js';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { hashToken, newOpaqueToken, signAccessToken } from '../../lib/tokens.js';
import { mailer } from '../../lib/mailer.js';
import { audit } from '../../lib/audit.js';

const BCRYPT_COST = 12;
const DAY = 86_400_000;
type Meta = { ip?: string; userAgent?: string };
// Pre-computed hash so login takes similar time whether or not the email exists (avoids user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export const publicUser = (u: any) => ({
  id: String(u._id), email: u.email, fullName: u.fullName, phone: u.phone ?? null, platformRole: u.platformRole,
  emailVerified: !!u.emailVerifiedAt, locale: u.locale, gender: u.gender ?? null, address: u.address ?? null,
  hasPhoto: !!u.photoKey, photoV: u.updatedAt ? +new Date(u.updatedAt) : 0, emergencyName: u.emergencyName ?? null, emergencyPhone: u.emergencyPhone ?? null, createdAt: u.createdAt,
});

async function issueSession(user: any, meta: Meta) {
  const refresh = newOpaqueToken();
  await RefreshToken.create({
    user: user._id, tokenHash: hashToken(refresh), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 255),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY),
  });
  return { access: signAccessToken({ sub: String(user._id), role: user.platformRole }), refresh };
}

async function createAuthToken(userId: unknown, type: 'PASSWORD_RESET' | 'EMAIL_VERIFY', ttlMs: number) {
  await AuthToken.updateMany({ user: userId, type, usedAt: null }, { usedAt: new Date() });
  const token = newOpaqueToken();
  await AuthToken.create({ user: userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function sendVerification(user: any) {
  const token = await createAuthToken(user._id, 'EMAIL_VERIFY', 2 * DAY);
  await mailer.send({ to: user.email, subject: 'Verify your EquibHub email', text: `Hi ${user.fullName},\n\nConfirm your email: ${env.CLIENT_URL}/verify-email?token=${token}\n\nThis link expires in 48 hours.` });
}

export async function register(input: { fullName: string; email: string; phone?: string; password: string }, meta: Meta) {
  const clash = await User.findOne({ $or: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] }).select('_id');
  if (clash) throw conflict('An account with this email or phone number already exists.');
  const user = await User.create({ fullName: input.fullName, email: input.email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, BCRYPT_COST) });
  await Notification.create({ user: user._id, type: 'REGISTRATION', title: 'Welcome to EquibHub', body: 'Your account is ready. Join or request to join an Equb to get started.' });
  await sendVerification(user);
  await audit({ actorId: String(user._id), action: 'user.register', entityType: 'User', entityId: String(user._id), ip: meta.ip });
  return { user, session: await issueSession(user, meta) };
}

export async function login(email: string, password: string, meta: Meta) {
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password.');
  if (user.status !== 'ACTIVE') throw forbidden('This account is suspended. Contact your Equb leader or support.');
  user.lastLoginAt = new Date();
  await user.save();
  await audit({ actorId: String(user._id), action: 'user.login', ip: meta.ip });
  return { user, session: await issueSession(user, meta) };
}

/** Rotates the refresh token. Re-use of a revoked token revokes every session for that user (theft signal). */
export async function refresh(rawToken: string, meta: Meta) {
  const row: any = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) }).populate('user');
  if (!row || !row.user) throw unauthorized();
  if (row.revokedAt) {
    // A token rotated a moment ago can still arrive from a parallel request or second tab: not theft.
    if (Date.now() - +row.revokedAt < 20_000) throw new AppError(401, 'Session is being renewed.', 'refresh_race');
    await RefreshToken.updateMany({ user: row.user._id, revokedAt: null }, { revokedAt: new Date() });
    throw unauthorized('Your session is no longer valid. Please sign in again.');
  }
  if (row.expiresAt < new Date() || row.user.status !== 'ACTIVE') throw unauthorized();
  row.revokedAt = new Date();
  await row.save();
  return { user: row.user, session: await issueSession(row.user, meta) };
}

export async function logout(rawToken?: string) {
  if (rawToken) await RefreshToken.updateMany({ tokenHash: hashToken(rawToken), revokedAt: null }, { revokedAt: new Date() });
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email });
  if (!user || user.status !== 'ACTIVE') return; // always respond the same way
  const token = await createAuthToken(user._id, 'PASSWORD_RESET', 60 * 60 * 1000);
  await mailer.send({ to: user.email, subject: 'Reset your EquibHub password', text: `Hi ${user.fullName},\n\nReset your password: ${env.CLIENT_URL}/reset-password?token=${token}\n\nThis link expires in 1 hour. If you did not ask for it, ignore this email.` });
}

async function consumeToken(raw: string, type: string) {
  const row = await AuthToken.findOne({ tokenHash: hashToken(raw) });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) throw badRequest('This link is invalid or has expired. Request a new one.');
  row.usedAt = new Date();
  await row.save();
  return row;
}

export async function resetPassword(token: string, password: string, ip?: string) {
  const row = await consumeToken(token, 'PASSWORD_RESET');
  await User.updateOne({ _id: row.user }, { passwordHash: await bcrypt.hash(password, BCRYPT_COST) });
  await RefreshToken.updateMany({ user: row.user, revokedAt: null }, { revokedAt: new Date() });
  await audit({ actorId: String(row.user), action: 'user.password_reset', ip });
}

export async function verifyEmail(token: string) {
  const row = await consumeToken(token, 'EMAIL_VERIFY');
  await User.updateOne({ _id: row.user }, { emailVerifiedAt: new Date() });
}

export const resendVerification = async (userId: string) => {
  const user = await User.findById(userId);
  if (user && !user.emailVerifiedAt) await sendVerification(user);
};

export async function changePassword(userId: string, current: string, next: string, meta: Meta) {
  const user = await User.findById(userId);
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw badRequest('Your current password is incorrect.');
  user.passwordHash = await bcrypt.hash(next, BCRYPT_COST);
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() }); // sign out other devices
  await audit({ actorId: userId, action: 'user.password_change', ip: meta.ip });
  return issueSession(user, meta);
}
