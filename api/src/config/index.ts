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
    permissioning: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    walletRegistry: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    tokenizedEuro: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    conditionalPayments: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
  const result = configSchema.safeParse({
    port: process.env['PORT'],
    nodeEnv: process.env['NODE_ENV'],
    logLevel: process.env['LOG_LEVEL'],
    blockchain: {
      rpcUrl: process.env['BLOCKCHAIN_RPC_URL'] || 'http://localhost:8545',
      chainId: process.env['BLOCKCHAIN_CHAIN_ID'] || 31337,
      operatorPrivateKey: process.env['BLOCKCHAIN_OPERATOR_PRIVATE_KEY'] || '',
    },
    contracts: {
      permissioning: process.env['CONTRACT_PERMISSIONING'],
      walletRegistry: process.env['CONTRACT_WALLET_REGISTRY'],
      tokenizedEuro: process.env['CONTRACT_TOKENIZED_EURO'],
      conditionalPayments: process.env['CONTRACT_CONDITIONAL_PAYMENTS'],
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
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;

// Re-export parameters manifest (loaded from JSON manifest in envs/ or via PARAMETERS_FILE)
export { parameters as rulebookParameters } from './parameters';
