/**
 * Classification Controller
 *
 * Handles HTTP requests for user classification endpoints.
 */

import { Request, Response } from 'express';
import { ClassificationService } from './classification.service';
import { Driver } from 'neo4j-driver';

export class ClassificationController {
  private classificationService: ClassificationService;

  constructor(driver: Driver) {
    this.classificationService = new ClassificationService(driver);
  }

  /**
   * POST /api/classification/classify
   * Classify a single user
   */
  async classifyUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId, confidenceThreshold, multiGroupThreshold } = req.body;

      if (!userId) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'userId is required',
        });
        return;
      }

      const result = await this.classificationService.classifyUser({
        userId,
        confidenceThreshold,
        multiGroupThreshold,
      });

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Classification error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: error.message,
        });
      } else if (error.message.includes('timeout')) {
        res.status(504).json({
          error: 'TIMEOUT',
          message: 'Classification timeout exceeded',
        });
      } else {
        res.status(500).json({
          error: 'CLASSIFICATION_ERROR',
          message: 'Failed to classify user',
          details: error.message,
        });
      }
    }
  }

  /**
   * POST /api/classification/reclassify-all
   * Batch reclassify all users
   */
  async reclassifyAllUsers(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.classificationService.reclassifyAllUsers();

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Batch reclassification error:', error);

      res.status(500).json({
        error: 'CLASSIFICATION_ERROR',
        message: 'Failed to reclassify users',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/classification/:userId
   * Get user classification
   */
  async getUserClassification(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const classification = await this.classificationService.getUserClassification(userId);

      if (!classification) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'User classification not found',
        });
        return;
      }

      res.status(200).json(classification);
    } catch (error: any) {
      console.error('Get classification error:', error);

      res.status(500).json({
        error: 'CLASSIFICATION_ERROR',
        message: 'Failed to get user classification',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/classification/metrics/performance
   * Get aggregate performance metrics
   */
  async getPerformanceMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.classificationService.getPerformanceMetrics();

      if (!metrics) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'No performance metrics available yet',
        });
        return;
      }

      res.status(200).json(metrics);
    } catch (error: any) {
      console.error('Get performance metrics error:', error);

      res.status(500).json({
        error: 'METRICS_ERROR',
        message: 'Failed to get performance metrics',
        details: error.message,
      });
    }
  }
}
