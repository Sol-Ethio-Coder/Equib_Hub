import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessPayload = { sub: string; role: 'USER' | 'SUPER_ADMIN' };

export const signAccessToken = (p: AccessPayload) =>
  jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_MIN * 60, algorithm: 'HS256' });

export const verifyAccessToken = (t: string) =>
  jwt.verify(t, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessPayload & jwt.JwtPayload;

/** Opaque random token (refresh / reset / verify). Only its SHA-256 hash is stored. */
export const newOpaqueToken = () => crypto.randomBytes(48).toString('base64url');
export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
