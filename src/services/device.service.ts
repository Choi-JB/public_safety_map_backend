import { AppError } from '../utils/errors.js';

export async function registerDevice(): Promise<never> {
  throw new AppError(501, 'NOT_IMPLEMENTED', 'Device register is deferred to app phase');
}
