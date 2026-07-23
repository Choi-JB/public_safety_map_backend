import type { RequestHandler } from 'express';
import * as reportService from '../services/report.service.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const data = await reportService.listReports(req.query as Record<string, unknown>);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const data = await reportService.createReport(req.user!.id, req.body, req.file);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const data = await reportService.updateReport(req.params.id, req.user!, req.body, req.file);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await reportService.deleteReport(req.params.id, req.user!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
