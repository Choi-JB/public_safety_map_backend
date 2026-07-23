import type { RequestHandler } from 'express';
import { notImplemented } from '../utils/errors.js';

export const stub: RequestHandler = (req, res) => {
  notImplemented(req, res);
};
