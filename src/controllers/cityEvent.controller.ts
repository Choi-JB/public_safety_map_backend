import type { RequestHandler } from 'express';
import * as cityEventService from '../services/cityEvent.service.js';

export const list: RequestHandler = async (_req, res, next) => {
  try {
    const data = await cityEventService.listCityEvents();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};
