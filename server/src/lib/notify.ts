import { env } from './../config/env.js';
import { Membership, Notification, User } from '../models/index.js';
import { mailer } from './mailer.js';
import { sendSms } from './sms.js';

type NType = 'REGISTRATION' | 'MEMBERSHIP_APPROVED' | 'MEMBERSHIP_REJECTED' | 'RECEIPT_SUBMITTED' | 'PAYMENT_VERIFIED' | 'PAYMENT_REJECTED' | 'CONTRIBUTION_REMINDER' | 'PAYMENT_OVERDUE' | 'ANNOUNCEMENT' | 'SUBSCRIPTION';
const SMS_TYPES = new Set<NType>(['PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'CONTRIBUTION_REMINDER', 'PAYMENT_OVERDUE', 'MEMBERSHIP_APPROVED']);

/** In-app notification, plus email (and SMS for key events) when those drivers are configured. */
export async function notify(userId: unknown, type: NType, title: string, body: string) {
  try {
    await Notification.create({ user: userId, type, title, body });
    if (type === 'REGISTRATION') return;
    const u: any = await User.findById(userId).select('email phone fullName status');
    if (!u || u.status !== 'ACTIVE') return;
    if (env.MAIL_DRIVER !== 'console') void mailer.send({ to: u.email, subject: title, text: `Hi ${u.fullName},\n\n${body}\n\nOpen EquibHub: ${env.CLIENT_URL}/app` });
    if (u.phone && SMS_TYPES.has(type)) void sendSms(u.phone, `EquibHub: ${title}. ${body}`.slice(0, 300));
  } catch (e) { console.error('notify failed', e); }
}

export async function notifyLeaders(groupId: string, type: NType, title: string, body: string) {
  const leaders = await Membership.find({ group: groupId, role: 'LEADER', status: 'ACTIVE' }).select('user');
  await Promise.all(leaders.map((l) => notify(l.user, type, title, body)));
}
