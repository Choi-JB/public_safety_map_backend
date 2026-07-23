import { Router } from 'express';
import * as ctrl from '../controllers/report.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../utils/imageUpload.js';

const router = Router();
router.get('/', ctrl.list);
router.post('/', authMiddleware, uploadImage, ctrl.create);
router.patch('/:id', authMiddleware, uploadImage, ctrl.update);
router.delete('/:id', authMiddleware, ctrl.remove);
export default router;
