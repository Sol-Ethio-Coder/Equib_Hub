/** Detect the real file type from magic bytes (never trust the client's mimetype or filename). */
export function sniff(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  if (b.length > 5 && b.subarray(0, 5).toString() === '%PDF-') return { mime: 'application/pdf', ext: '.pdf' };
  return null;
}
export const isImage = (mime?: string) => !!mime && mime.startsWith('image/');
