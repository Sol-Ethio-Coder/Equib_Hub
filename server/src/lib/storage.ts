import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export { sniff } from './filetype.js';

/** Storage abstraction. Receipts and photos are private: only the key is stored, never a public URL. */
export interface Storage { put(buf: Buffer, ext: string): Promise<string>; get(key: string): Promise<Buffer> }

// Default: MongoDB GridFS. Files live in your Atlas database, so they survive redeploys and need no extra service.
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'files' });
const gridfs: Storage = {
  put: (buf, ext) => new Promise((resolve, reject) => {
    const up = bucket().openUploadStream(crypto.randomUUID() + ext);
    up.once('error', reject);
    up.once('finish', () => resolve(String(up.id)));
    up.end(buf);
  }),
  get: (key) => new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const s = bucket().openDownloadStream(new mongoose.Types.ObjectId(key));
    s.on('data', (c: Buffer) => chunks.push(c));
    s.once('error', reject);
    s.once('end', () => resolve(Buffer.concat(chunks)));
  }),
};

// Development fallback: files on local disk (lost on hosts with ephemeral disks).
const dir = path.resolve(process.cwd(), 'uploads');
const local: Storage = {
  async put(buf, ext) { await fs.mkdir(dir, { recursive: true }); const key = crypto.randomUUID() + ext; await fs.writeFile(path.join(dir, key), buf); return key; },
  get: (key) => fs.readFile(path.join(dir, path.basename(key))),
};

const isGridKey = (k: string) => /^[a-f0-9]{24}$/.test(k);
// Reads work for both kinds of keys, so switching drivers never orphans old files.
export const storage: Storage = {
  put: (buf, ext) => (env.STORAGE_DRIVER === 'local' ? local : gridfs).put(buf, ext),
  get: (key) => (isGridKey(key) ? gridfs.get(key) : local.get(key)),
};
