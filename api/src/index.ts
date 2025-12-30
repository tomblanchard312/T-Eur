import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errors.js';
import { requestId, requestLogger, standardRateLimiter } from './middleware/common.js';
import { blockchainService } from './services/blockchain.js';

// Import routes
import healthRouter from './routes/health.js';
import walletsRouter from './routes/wallets.js';
import transfersRouter from './routes/transfers.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', config.auth.apiKeyHeader, 'X-Request-Id', 'X-Idempotency-Key'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression
app.use(compression());

// Request ID and logging
app.use(requestId);
app.use(requestLogger);

// Rate limiting (applied after auth for better key generation)
app.use(standardRateLimiter);

// OpenAPI Documentation
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'tEUR API Gateway',
    version: '1.0.0',
    description: 'REST API Gateway for the Tokenized Euro (tEUR) Digital Currency',
    contact: {
      name: 'tEUR Support',
      email: 'support@teuro.eu',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Wallets', description: 'Wallet management operations' },
    { name: 'Transfers', description: 'Token transfer and waterfall operations' },
    { name: 'Conditional Payments', description: 'Escrow and conditional payment operations' },
    { name: 'Admin', description: 'Administrative operations (ECB/NCB only)' },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: config.auth.apiKeyHeader,
        description: 'API key for institution authentication',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for session authentication',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
              requestId: { type: 'string' },
            },
          },
        },
      },
      RegisterWallet: {
        type: 'object',
        required: ['wallet', 'walletType', 'kycHash', 'idempotencyKey'],
        properties: {
          wallet: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          walletType: { type: 'string', enum: ['INDIVIDUAL', 'MERCHANT', 'PSP', 'NCB', 'BANK'] },
          linkedBankAccount: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          kycHash: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
          idempotencyKey: { type: 'string', format: 'uuid' },
        },
      },
      Transfer: {
        type: 'object',
        required: ['from', 'to', 'amount', 'idempotencyKey'],
        properties: {
          from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          amount: { type: 'integer', description: 'Amount in euro cents' },
          idempotencyKey: { type: 'string', format: 'uuid' },
        },
      },
      ConditionalPayment: {
        type: 'object',
        required: ['payee', 'amount', 'conditionType', 'conditionData', 'expiresAt', 'idempotencyKey'],
        properties: {
          payee: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          amount: { type: 'integer', description: 'Amount in euro cents' },
          conditionType: { type: 'string', enum: ['DELIVERY', 'TIME_LOCK', 'MILESTONE', 'ORACLE', 'MULTI_SIG'] },
          conditionData: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
          expiresAt: { type: 'integer', description: 'Unix timestamp' },
          arbiter: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          idempotencyKey: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
  security: [
    { apiKey: [] },
    { bearerAuth: [] },
  ],
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'tEUR API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// API Routes
const apiRouter = express.Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/wallets', walletsRouter);
apiRouter.use('/transfers', transfersRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/admin', adminRouter);

app.use('/api/v1', apiRouter);

// Root redirect to docs
app.get('/', (_req, res) => {
  res.redirect('/api/docs');
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// Global error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Initialize blockchain service
    await blockchainService.initialize();
    
    app.listen(config.port, () => {
      logger.info(`🚀 tEUR API Gateway started`, {
        port: config.port,
        env: config.nodeEnv,
        docsUrl: `http://localhost:${config.port}/api/docs`,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();

export { app };
