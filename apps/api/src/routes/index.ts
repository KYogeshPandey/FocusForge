import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { taskRoutes } from './taskRoutes.js';
import { habitRoutes } from './habitRoutes.js';
import { studySessionRoutes } from './studySessionRoutes.js';
import { focusSessionRoutes } from './focusSessionRoutes.js';
import { goalRoutes } from './goalRoutes.js';
import { analyticsRoutes } from './analyticsRoutes.js';
import { importRoutes } from './importRoutes.js';
import { healthRoutes } from './healthRoutes.js';

const apiV1Router = Router();

apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/tasks', taskRoutes);
apiV1Router.use('/habits', habitRoutes);
apiV1Router.use('/sessions', studySessionRoutes);
apiV1Router.use('/focus-sessions', focusSessionRoutes);
apiV1Router.use('/goals', goalRoutes);
apiV1Router.use('/analytics', analyticsRoutes);
apiV1Router.use('/import', importRoutes);
apiV1Router.use('/health', healthRoutes);

export { apiV1Router };
