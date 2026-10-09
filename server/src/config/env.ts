import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  CLIENT_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console'),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587), SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(), SMTP_PASS: z.string().optional(), RESEND_API_KEY: z.string().optional(),
  SMS_DRIVER: z.enum(['none', 'africastalking']).default('none'),
  AT_USERNAME: z.string().optional(), AT_API_KEY: z.string().optional(), AT_SENDER: z.string().optional(),
  REMINDERS_ENABLED: z.enum(['true', 'false']).default('true'),
  MAIL_FROM: z.string().default('EquibHub <no-reply@equibhub.local>'),
  TRIAL_DAYS: z.coerce.number().default(30),
  PRO_PRICE_ETB: z.coerce.number().default(500),
  BILLING_INSTRUCTIONS: z.string().default('Send the payment by Telebirr, CBE Birr or bank transfer to the EquibHub account, then upload your receipt here. Payment details are shown by the platform team.'),
  STORAGE_DRIVER: z.enum(['mongodb', 'local']).default('mongodb'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
