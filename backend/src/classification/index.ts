/**
 * Classification Module
 *
 * Exports classification service, controller, routes, and types.
 */

export { ClassificationService } from './classification.service';
export { ClassificationController } from './classification.controller';
export { createClassificationRoutes } from './classification.routes';
export * from './types';
export {
  userSegmentationService,
  SEGMENTS,
  type UserSegment,
  type SegmentAssignment,
  type BatchSegmentResult,
} from './user-segmentation';
