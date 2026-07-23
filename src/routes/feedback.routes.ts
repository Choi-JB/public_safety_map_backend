import { Router } from 'express';
import * as ctrl from '../controllers/feedback.controller.js';

const router = Router();
router.use(ctrl.stub);
export default router;
