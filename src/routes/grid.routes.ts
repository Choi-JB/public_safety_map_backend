import { Router } from 'express';
import * as ctrl from '../controllers/grid.controller.js';

const router = Router();
router.use(ctrl.stub);
export default router;
