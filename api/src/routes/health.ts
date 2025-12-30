import { Router, Request, Response } from 'express';
import { blockchainService } from '../services/blockchain.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    
    // Check blockchain connectivity
    const blockchainStart = Date.now();
    try {
      await blockchainService.getBlockNumber();
      checks.blockchain = {
        status: 'healthy',
        latency: Date.now() - blockchainStart,
      };
    } catch (error) {
      checks.blockchain = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check if any critical service is unhealthy
    const isHealthy = Object.values(checks).every(c => c.status === 'healthy');

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
    });
  })
);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Readiness check for load balancers
 *     tags: [Health]
 */
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      await blockchainService.getBlockNumber();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  })
);

/**
 * @openapi
 * /health/live:
 *   get:
 *     summary: Liveness check for Kubernetes
 *     tags: [Health]
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

export default router;
