import { z } from 'zod';
import { normalizePhone } from '../../utils/phone.js';

const password = z.string().min(10, 'Use at least 10 characters.').max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter.').regex(/\d/, 'Include at least one number.');

const phone = z.string().trim().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) { ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number, e.g. 0911 22 33 44.' }); return z.NEVER; }
  return n;
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  password,
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Enter your password.'),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetSchema = z.object({ token: z.string().min(20), password });
export const verifySchema = z.object({ token: z.string().min(20) });

const opt = (n: number) => z.string().trim().max(n).optional().transform((v) => v || undefined);
const optPhone = z.string().trim().optional().transform((v, ctx) => {
  if (!v) return undefined;
  const n = normalizePhone(v);
  if (!n) { ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number, e.g. 0911 22 33 44.' }); return z.NEVER; }
  return n;
});
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100).optional(),
  phone: optPhone, gender: opt(20), address: opt(200), emergencyName: opt(100), emergencyPhone: optPhone,
});
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password.'), newPassword: password });
