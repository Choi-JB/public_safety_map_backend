import { Router } from 'express';
import * as ctrl from '../controllers/device.controller.js';

const router = Router();
router.post('/register', ctrl.register);
export default router;
