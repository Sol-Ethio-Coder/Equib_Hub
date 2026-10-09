import mongoose, { Schema } from 'mongoose';

// Every model returns `id` (string) instead of `_id`, and never leaks secrets in JSON.
const base = {
  timestamps: true,
  toJSON: { transform(_d: unknown, ret: any) { ret.id = String(ret._id); delete ret._id; delete ret.__v; delete ret.passwordHash; delete ret.tokenHash; return ret; } },
};
const ref = (model: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: model, ...extra });
const oneOf = (values: string[], def?: string) => ({ type: String, enum: values, ...(def ? { default: def } : {}) });

function mk(name: string, def: any, indexes: [any, any?][] = [], opts: any = {}) {
  const s = new Schema(def, { ...base, ...opts });
  indexes.forEach(([f, o]) => s.index(f, o));
  return mongoose.model(name, s);
}

// Platform role is on the user; the per-group role (MEMBER/LEADER) is on Membership,
// so one person can lead one Equb and be a member of another.
export const User = mk('User', {
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true }, // E.164, e.g. +251911000000
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  photoKey: String, photoMime: String, gender: String, address: String, emergencyName: String, emergencyPhone: String,
  locale: { type: String, default: 'en' },
  platformRole: oneOf(['USER', 'SUPER_ADMIN'], 'USER'),
  status: oneOf(['ACTIVE', 'SUSPENDED'], 'ACTIVE'),
  emailVerifiedAt: Date, lastLoginAt: Date,
});

export const RefreshToken = mk('RefreshToken', {
  user: ref('User', { required: true, index: true }), tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }, revokedAt: Date, userAgent: String, ip: String,
}, [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]]);

export const AuthToken = mk('AuthToken', {
  user: ref('User', { required: true }), type: oneOf(['PASSWORD_RESET', 'EMAIL_VERIFY']),
  tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true }, usedAt: Date,
}, [[{ expiresAt: 1 }, { expireAfterSeconds: 86400 }]]);

// Money is stored as integer minor units (e.g. santim) + a currency code. No floats.
export const EqubGroup = mk('EqubGroup', {
  name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true },
  description: String, currency: { type: String, default: 'ETB' }, contributionMinor: { type: Number, required: true },
  frequency: oneOf(['WEEKLY', 'BIWEEKLY', 'MONTHLY'], 'MONTHLY'), startDate: { type: Date, required: true },
  maxMembers: { type: Number, required: true }, dueDayOfMonth: { type: Number, default: 5 },
  status: oneOf(['PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'CLOSED', 'REJECTED'], 'PENDING_APPROVAL'),
  trialEndsAt: Date, // free trial end (30 days by default)
  proUntil: Date,    // paid Pro plan end (500 ETB per group per month)
  createdBy: ref('User'), planWarnedAt: Date,
});

export const Membership = mk('Membership', {
  user: ref('User', { required: true }), group: ref('EqubGroup', { required: true }),
  role: oneOf(['MEMBER', 'LEADER'], 'MEMBER'), status: oneOf(['PENDING', 'ACTIVE', 'SUSPENDED', 'REMOVED'], 'PENDING'), joinedAt: Date,
}, [[{ user: 1, group: 1 }, { unique: true }], [{ group: 1, status: 1 }]]);

export const Payment = mk('Payment', {
  membership: ref('Membership', { required: true }), group: ref('EqubGroup', { required: true }),
  period: { type: Date, required: true }, // first day of the contribution month (UTC)
  expectedMinor: { type: Number, required: true }, paidMinor: Number, currency: { type: String, default: 'ETB' },
  paidAt: Date, method: oneOf(['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CASH', 'OTHER']),
  status: oneOf(['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'OVERDUE'], 'PENDING'),
  verifiedBy: ref('User'), verifiedAt: Date, rejectionReason: String, notes: String, remindedAt: Date,
}, [[{ membership: 1, period: 1 }, { unique: true }], [{ group: 1, period: 1, status: 1 }]]);

// Many receipts per payment, so a rejected receipt keeps its history after re-upload.
export const Receipt = mk('Receipt', {
  payment: ref('Payment', { required: true, index: true }), storageKey: { type: String, required: true },
  mimeType: String, sizeBytes: Number, uploadedBy: ref('User'),
});

export const Notification = mk('Notification', {
  user: ref('User', { required: true }), title: String, body: String, readAt: Date,
  type: oneOf(['REGISTRATION', 'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED', 'RECEIPT_SUBMITTED', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'CONTRIBUTION_REMINDER', 'PAYMENT_OVERDUE', 'ANNOUNCEMENT', 'SUBSCRIPTION']),
}, [[{ user: 1, createdAt: -1 }]]);

export const Announcement = mk('Announcement', {
  group: ref('EqubGroup', { required: true, index: true }), author: ref('User'), title: String, body: String,
});

export const AuditLog = mk('AuditLog', {
  actor: ref('User'), group: ref('EqubGroup'), action: { type: String, required: true },
  entityType: String, entityId: String, metadata: Schema.Types.Mixed, ip: String,
}, [[{ createdAt: -1 }]], { timestamps: { createdAt: true, updatedAt: false } });

// A leader's payment for the Pro plan, reviewed by the Super Admin. Approving it extends EqubGroup.proUntil.
export const BillingPayment = mk('BillingPayment', {
  group: ref('EqubGroup', { required: true, index: true }), submittedBy: ref('User', { required: true }),
  months: { type: Number, required: true }, amountMinor: { type: Number, required: true }, currency: { type: String, default: 'ETB' },
  method: oneOf(['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CASH', 'OTHER']),
  storageKey: String, mimeType: String, sizeBytes: Number,
  status: oneOf(['SUBMITTED', 'VERIFIED', 'REJECTED'], 'SUBMITTED'),
  reviewedBy: ref('User'), reviewedAt: Date, rejectionReason: String,
}, [[{ status: 1, createdAt: -1 }]]);

// Invite links a leader can share (WhatsApp, Telegram, SMS). Joining through one is pre-approved.
export const Invite = mk('Invite', {
  group: ref('EqubGroup', { required: true, index: true }), createdBy: ref('User'),
  tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true },
  maxUses: { type: Number, default: 20 }, uses: { type: Number, default: 0 }, revokedAt: Date,
}, [[{ expiresAt: 1 }, { expireAfterSeconds: 2_592_000 }]]);
