import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) =>
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found.' } });

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'validation', message: 'Please check the highlighted fields.', fields: err.flatten().fieldErrors } });
  }
  if (err?.name === 'MulterError') {
    const m = err.code === 'LIMIT_FILE_SIZE' ? 'That file is larger than 5 MB.' : 'Upload failed. Choose one file and try again.';
    return res.status(400).json({ error: { code: 'upload', message: m } });
  }
  if (err?.name === 'CastError') return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } }); // malformed ObjectId
  if (err?.code === 11000) return res.status(409).json({ error: { code: 'conflict', message: 'That record already exists.' } });
  if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  console.error(err);
  res.status(500).json({ error: { code: 'server_error', message: isProd ? 'Something went wrong. Please try again.' : String(err?.message ?? err) } });
};
