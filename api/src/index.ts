import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import type { Server } from 'node:http';
import { config, rulebookParameters } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errors.js';
import { requestId, requestLogger, standardRateLimiter, idempotency } from './middleware/common.js';
import { requestSignature } from './middleware/requestSignature.js';
import { blockchainService } from './services/blockchain.js';

import healthRouter from './routes/health.js';
import walletsRouter from './routes/wallets.js';
import transfersRouter from './routes/transfers.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';
import fraudRouter from './routes/fraud.js';
import auditRouter from './routes/audit.js';
import merchantsRouter from './routes/merchants.js';
import governanceRouter from './routes/governance.js';

const app = express();
let server: Server | undefined;
let shuttingDown = false;

if (config.trustProxy !== false) {
  app.set('trust proxy', config.trustProxy);
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: config.enableApiDocs ? ["'self'", "'unsafe-inline'"] : ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' },
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    config.auth.apiKeyHeader,
    'X-Request-Id',
    'X-Idempotency-Key',
    'X-tEUR-Timestamp',
    'X-tEUR-Nonce',
    'X-tEUR-Signature',
  ],
}));

app.use(express.json({
  limit: '1mb',
  strict: true,
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({
  extended: true,
  limit: '1mb',
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));

app.use((req, _res, next) => {
  if (req.query) {
    for (const key in req.query) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0];
      }
    }
  }
  next();
});

app.use(compression());
app.use(requestId);
app.use(requestLogger);
app.use(standardRateLimiter);

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'tEUR API Gateway',
    version: '1.0.0',
    description: 'REST API Gateway for the Tokenized Euro research implementation',
    contact: { name: 'tEUR Project' },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Wallets', description: 'Wallet management operations' },
    { name: 'Transfers', description: 'Token transfer and waterfall operations' },
    { name: 'Conditional Payments', description: 'Escrow and conditional payment operations' },
    { name: 'Admin', description: 'Administrative operations' },
    { name: 'Audit', description: 'Audit and compliance operations' },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: config.auth.apiKeyHeader,
        description: 'Institution API key identifier',
      },
      hmacTimestamp: {
        type: 'apiKey',
        in: 'header',
        name: 'X-tEUR-Timestamp',
        description: 'Unix timestamp in milliseconds used in the HMAC canonical request',
      },
      hmacNonce: {
        type: 'apiKey',
        in: 'header',
        name: 'X-tEUR-Nonce',
        description: 'Unique 16-128 character nonce used once within the signature window',
      },
      hmacSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'X-tEUR-Signature',
        description: 'v1=<hex HMAC-SHA256 signature>',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT session token',
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
          amount: { type: 'integer', minimum: 1, description: 'Amount in euro cents' },
          idempotencyKey: { type: 'string', format: 'uuid' },
        },
      },
      ConditionalPayment: {
        type: 'object',
        required: ['payee', 'amount', 'conditionType', 'conditionData', 'expiresAt', 'idempotencyKey'],
        properties: {
          payee: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          amount: { type: 'integer', minimum: 1, description: 'Amount in euro cents' },
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
    { apiKey: [], hmacTimestamp: [], hmacNonce: [], hmacSignature: [] },
    { bearerAuth: [] },
  ],
};

if (config.enableApiDocs) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'tEUR API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
}

const apiRouter = express.Router();
apiRouter.use(requestSignature);
apiRouter.use(idempotency);
apiRouter.use('/health', healthRouter);
apiRouter.use('/wallets', walletsRouter);
apiRouter.use('/transfers', transfersRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/fraud', fraudRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/merchants', merchantsRouter);
apiRouter.use('/governance', governanceRouter);
app.use('/api/v1', apiRouter);

app.get('/', (_req, res) => {
  res.json({
    service: 'tEUR API Gateway',
    version: '1.0.0',
    status: 'available',
    documentation: config.enableApiDocs ? '/api/docs' : undefined,
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

app.use(errorHandler);

function sanitizedErrorCode(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  return 'UNKNOWN_ERROR';
}

async function start(): Promise<void> {
  let blockchainInitialized = false;
  try {
    await blockchainService.initialize();
    blockchainInitialized = true;
  } catch (error) {
    logger.error('API_GATEWAY', 'INTERNAL_SERVER_ERROR', {
      errorCode: 'BLOCKCHAIN_INIT_FAILED',
      details: { errorType: sanitizedErrorCode(error) },
    });
    if (!(config.nodeEnv === 'test' || process.env.VITEST)) {
      process.exitCode = 1;
      return;
    }
    logger.warn('API_GATEWAY', 'INTERNAL_SERVER_ERROR', {
      errorCode: 'BLOCKCHAIN_UNAVAILABLE_TEST_MODE',
    });
  }

  server = app.listen(config.port, () => {
    logger.info('API_GATEWAY', 'RESOURCE_CREATED', {
      resourceId: `port-${config.port}`,
      details: {
        port: config.port,
        env: config.nodeEnv,
        docsEnabled: config.enableApiDocs,
        blockchainInitialized,
        trustProxy: config.trustProxy,
        hmacSigningRequired: process.env['REQUIRE_HMAC_SIGNATURES'] ?? 'environment-default',
      },
    });

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      logger.info('API_GATEWAY', 'RESOURCE_UPDATED', {
        resourceId: 'rulebook-parameters',
        details: { parameters: rulebookParameters },
      });
    } else {
      logger.info('API_GATEWAY', 'RESOURCE_UPDATED', {
        resourceId: 'rulebook-parameters',
        details: { loaded: true },
      });
    }
  });
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info('API_GATEWAY', 'RESOURCE_DELETED', {
    resourceId: 'process',
    details: { signal, phase: 'shutdown_started' },
  });

  const forceExitTimer = setTimeout(() => {
    logger.error('API_GATEWAY', 'INTERNAL_SERVER_ERROR', {
      errorCode: 'GRACEFUL_SHUTDOWN_TIMEOUT',
    });
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (!server) {
    clearTimeout(forceExitTimer);
    process.exit(0);
    return;
  }

  server.close(error => {
    clearTimeout(forceExitTimer);
    if (error) {
      logger.error('API_GATEWAY', 'INTERNAL_SERVER_ERROR', {
        errorCode: 'HTTP_SERVER_CLOSE_FAILED',
        details: { errorType: sanitizedErrorCode(error) },
      });
      process.exit(1);
      return;
    }

    logger.info('API_GATEWAY', 'RESOURCE_DELETED', {
      resourceId: 'http-server',
      details: { phase: 'shutdown_complete' },
    });
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

void start();

export { app, start, shutdown };
