import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import prisma from './config/prismaClient.js';
import { errorHandler } from './utils/errors.js';
import { uploadRoot } from './utils/imageUpload.js';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import reportRoutes from './routes/report.routes.js';
import deviceRoutes from './routes/device.routes.js';
import cityEventRoutes from './routes/cityEvent.routes.js';
import gridRoutes from './routes/grid.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
const PORT = Number(process.env.PORT) || 4100;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadRoot));

const api = express.Router();
api.use('/health', healthRoutes);
api.use('/auth', authRoutes);
api.use('/reports', reportRoutes);
api.use('/devices', deviceRoutes);
api.use('/city-events', cityEventRoutes);
api.use('/grids', gridRoutes);
api.use('/feedbacks', feedbackRoutes);
api.use('/admin', adminRoutes);
app.use('/api', api);

app.use(errorHandler);

async function start() {
  await prisma.$connect();
  app.listen(config.port, () => {
    console.log(`API listening on :${config.port}`);
  });
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('app.ts') || process.argv[1].endsWith('app.js'));

if (isDirectRun) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

export default app;
