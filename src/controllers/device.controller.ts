import type { RequestHandler } from 'express';
import * as deviceService from '../services/device.service.js';

export const register: RequestHandler = async (req, res, next) => {
  try {
    await deviceService.registerDevice();
    res.status(501).end();
  } catch (err) {
    next(err);
  }
};
