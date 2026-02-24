import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

import { initializeDriver, closeDriver } from './config/neo4j.js';
import logger from './config/logger.js';
import { initializeConstraints } from './utils/dbInit.js';
import {
  requestLogger,
  errorHandler,
  notFoundHandler,
  corsMiddleware,
} from './middleware/errorMiddleware.js';

// Routes
import citizenRoutes from './routes/citizenRoutes.js';
import userGroupRoutes from './routes/userGroupRoutes.js';
import schemeRoutes from './routes/schemeRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and parsing middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Custom middleware
app.use(corsMiddleware);
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// API version endpoint
app.get('/api/v1/status', (req, res) => {
  res.status(200).json({
    success: true,
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
const apiV1 = '/api/v1';

app.use(`${apiV1}/citizens`, citizenRoutes);
app.use(`${apiV1}/user-groups`, userGroupRoutes);
app.use(`${apiV1}/schemes`, schemeRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Initiating graceful shutdown...');
  try {
    await closeDriver();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Initialize Neo4j driver
    await initializeDriver();
    logger.info('Neo4j connection established');

    // Initialize database schema
    await initializeConstraints();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api/v1/status`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
