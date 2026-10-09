import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { groupsRouter } from './modules/groups/groups.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { miscRouter } from './modules/misc/misc.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/billing', billingRouter);
app.use('/api', miscRouter);

app.use(notFoundHandler);
app.use(errorHandler);
