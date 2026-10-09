export class AppError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}
export const badRequest = (m: string) => new AppError(400, m, 'bad_request');
export const unauthorized = (m = 'Please sign in to continue.') => new AppError(401, m, 'unauthorized');
export const forbidden = (m = 'You do not have permission to do that.') => new AppError(403, m, 'forbidden');
export const notFound = (m = 'Not found.') => new AppError(404, m, 'not_found');
export const conflict = (m: string) => new AppError(409, m, 'conflict');
