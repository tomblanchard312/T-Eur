import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Blockchain
  blockchain: z.object({
    rpcUrl: z.string().url(),
    chainId: z.coerce.number(),
    operatorPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  }),

  // Contracts
  contracts: z.object({
    permissioning: z.string(),
    walletRegistry: z.string(),
    tokenizedEuro: z.string(),
    conditionalPayments: z.string(),
  }),

  // Auth
  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiresIn: z.union([z.string(), z.number()]).default('1h'),
    apiKeyHeader: z.string().default('X-API-Key'),
  }),

  // Rate Limiting
  rateLimit: z.object({
    windowMs: z.coerce.number().default(60000),
    max: z.coerce.number().default(100),
  }),

  // CORS
  cors: z.object({
    origin: z.string().default('*'),
    credentials: z.coerce.boolean().default(false),
  }),
});

function loadConfig() {
  const isTest = process.env['NODE_ENV'] === 'test' || !!process.env['VITEST'];
  const dummyAddr = '0x1234567890123456789012345678901234567890';
  const dummyKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const result = configSchema.safeParse({
    port: process.env['PORT'],
    nodeEnv: process.env['NODE_ENV'],
    logLevel: process.env['LOG_LEVEL'],
    blockchain: {
      rpcUrl: process.env['BLOCKCHAIN_RPC_URL'] || 'http://localhost:8545',
      chainId: process.env['BLOCKCHAIN_CHAIN_ID'] || 31337,
      operatorPrivateKey: process.env['BLOCKCHAIN_OPERATOR_PRIVATE_KEY'] || dummyKey,
    },
    contracts: {
      permissioning: process.env['CONTRACT_PERMISSIONING'] || dummyAddr,
      walletRegistry: process.env['CONTRACT_WALLET_REGISTRY'] || dummyAddr,
      tokenizedEuro: process.env['CONTRACT_TOKENIZED_EURO'] || dummyAddr,
      conditionalPayments: process.env['CONTRACT_CONDITIONAL_PAYMENTS'] || dummyAddr,
    },
    auth: {
      jwtSecret: process.env['JWT_SECRET'] || 'development-secret-key-min-32-chars!',
      jwtExpiresIn: process.env['JWT_EXPIRES_IN'],
      apiKeyHeader: process.env['API_KEY_HEADER'],
    },
    rateLimit: {
      windowMs: process.env['RATE_LIMIT_WINDOW_MS'],
      max: process.env['RATE_LIMIT_MAX'],
    },
    cors: {
      origin: process.env['CORS_ORIGIN'],
      credentials: process.env['CORS_CREDENTIALS'],
    },
  });

  if (!result.success) {
    // Avoid importing the main logger here to prevent circular dependency during startup.
    // Emit a structured error to stderr so bootstrapping systems can parse it.
    const out = {
      timestamp: new Date().toISOString(),
      level: 'error',
      component: 'config-loader',
      event: 'config_validation_failed',
      details: result.error.format(),
    };
    try { process.stderr.write(JSON.stringify(out) + '\n'); } catch (_) { /* best-effort */ }
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;

// Re-export parameters manifest (loaded from JSON manifest in envs/ or via PARAMETERS_FILE)
export { parameters as rulebookParameters } from './parameters';
