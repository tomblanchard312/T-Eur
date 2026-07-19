import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const configSchema = z.object({
  port: z.coerce.number().int().positive().max(65535).default(3000),
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  trustProxy: z.union([z.literal(false), z.coerce.number().int().nonnegative()]).default(false),
  enableApiDocs: z.coerce.boolean().default(false),
  allowDemoIdentities: z.coerce.boolean().default(false),

  blockchain: z.object({
    rpcUrl: z.string().url(),
    chainId: z.coerce.number().int().positive(),
    operatorPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  }),

  contracts: z.object({
    permissioning: addressSchema,
    walletRegistry: addressSchema,
    tokenizedEuro: addressSchema,
    conditionalPayments: addressSchema,
  }),

  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiresIn: z.union([z.string(), z.number()]).default('1h'),
    jwtIssuer: z.string().min(1),
    jwtAudience: z.string().min(1),
    apiKeyHeader: z.string().default('X-API-Key'),
  }),

  mtls: z.object({
    enabled: z.coerce.boolean().default(false),
    trustedIngressCidrs: z.array(z.string().min(1)).default([]),
    ingressToken: z.string().default(''),
    revokedFingerprints: z.array(z.string().regex(/^[a-fA-F0-9]{64}$/)).default([]),
  }),

  rateLimit: z.object({
    windowMs: z.coerce.number().int().positive().default(60000),
    max: z.coerce.number().int().positive().default(100),
  }),

  cors: z.object({
    origin: z.string().default('http://localhost:5173'),
    credentials: z.coerce.boolean().default(false),
  }),
});

function structuredConfigError(details: unknown): never {
  const out = {
    timestamp: new Date().toISOString(),
    level: 'error',
    component: 'config-loader',
    event: 'config_validation_failed',
    details,
  };
  try {
    process.stderr.write(`${JSON.stringify(out)}\n`);
  } catch {
    // stderr may be unavailable during process teardown.
  }
  throw new Error('Invalid configuration');
}

function csv(value: string | undefined): string[] {
  return value?.split(',').map(item => item.trim()).filter(Boolean) ?? [];
}

function loadConfig() {
  const nodeEnv = process.env['NODE_ENV'] ?? (process.env['VITEST'] ? 'test' : 'development');
  const permitsLocalDefaults = nodeEnv === 'development' || nodeEnv === 'test';
  const dummyAddr = '0x1234567890123456789012345678901234567890';
  const dummyKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const developmentJwtSecret = 'development-secret-key-min-32-chars!';

  const required = (name: string, localDefault?: string): string | undefined => {
    const value = process.env[name];
    if (value) return value;
    if (permitsLocalDefaults) return localDefault;
    return undefined;
  };

  const result = configSchema.safeParse({
    port: process.env['PORT'],
    nodeEnv,
    logLevel: process.env['LOG_LEVEL'],
    trustProxy: process.env['TRUST_PROXY'] ?? false,
    enableApiDocs: process.env['ENABLE_API_DOCS'] ?? permitsLocalDefaults,
    allowDemoIdentities: process.env['ALLOW_DEMO_IDENTITIES'] ?? nodeEnv === 'test',
    blockchain: {
      rpcUrl: required('BLOCKCHAIN_RPC_URL', 'http://localhost:8545'),
      chainId: required('BLOCKCHAIN_CHAIN_ID', '31337'),
      operatorPrivateKey: required('BLOCKCHAIN_OPERATOR_PRIVATE_KEY', dummyKey),
    },
    contracts: {
      permissioning: required('CONTRACT_PERMISSIONING', dummyAddr),
      walletRegistry: required('CONTRACT_WALLET_REGISTRY', dummyAddr),
      tokenizedEuro: required('CONTRACT_TOKENIZED_EURO', dummyAddr),
      conditionalPayments: required('CONTRACT_CONDITIONAL_PAYMENTS', dummyAddr),
    },
    auth: {
      jwtSecret: required('JWT_SECRET', developmentJwtSecret),
      jwtExpiresIn: process.env['JWT_EXPIRES_IN'],
      jwtIssuer: required('JWT_ISSUER', 'teur-local'),
      jwtAudience: required('JWT_AUDIENCE', 'teur-api'),
      apiKeyHeader: process.env['API_KEY_HEADER'],
    },
    mtls: {
      enabled: process.env['MTLS_ENABLED'] ?? !permitsLocalDefaults,
      trustedIngressCidrs: csv(process.env['MTLS_TRUSTED_INGRESS_CIDRS']),
      ingressToken: process.env['MTLS_INGRESS_TOKEN'] ?? '',
      revokedFingerprints: csv(process.env['MTLS_REVOKED_FINGERPRINTS']).map(value => value.toLowerCase()),
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

  if (!result.success) structuredConfigError(result.error.format());

  if (!permitsLocalDefaults && result.data.allowDemoIdentities) {
    structuredConfigError({ allowDemoIdentities: ['Demo identities are forbidden outside development and test'] });
  }

  if (!permitsLocalDefaults && result.data.cors.origin === '*') {
    structuredConfigError({ cors: { origin: ['Wildcard CORS is forbidden outside development and test'] } });
  }

  if (!permitsLocalDefaults && !result.data.mtls.enabled) {
    structuredConfigError({ mtls: { enabled: ['Institutional mTLS is required in staging and production'] } });
  }

  if (result.data.mtls.enabled) {
    if (result.data.mtls.trustedIngressCidrs.length === 0) {
      structuredConfigError({ mtls: { trustedIngressCidrs: ['At least one trusted ingress CIDR is required'] } });
    }
    if (result.data.mtls.ingressToken.length < 32) {
      structuredConfigError({ mtls: { ingressToken: ['Ingress authentication token must be at least 32 characters'] } });
    }
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;

export { parameters as rulebookParameters } from './parameters';
