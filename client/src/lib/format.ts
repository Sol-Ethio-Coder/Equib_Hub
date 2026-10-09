import { brand } from '@/config/brand';
export const money = (minor: number, currency = brand.currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100);
export const STATUS_STYLE: Record<string, string> = {
  VERIFIED: 'bg-brand/15 text-brand', SUBMITTED: 'bg-gold/20 text-gold', PENDING: 'bg-line text-muted',
  REJECTED: 'bg-danger/15 text-danger', OVERDUE: 'bg-danger/15 text-danger', ACTIVE: 'bg-brand/15 text-brand', SUSPENDED: 'bg-gold/20 text-gold',
};
