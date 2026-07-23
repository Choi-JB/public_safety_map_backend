import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';

export const signup: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.signup(req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};
