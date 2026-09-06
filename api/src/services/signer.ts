/**
 * Operator signing.
 *
 * Two concerns are handled here that a bare `ethers.Wallet` does not:
 *
 * 1. Key custody. Production must not hold raw key material in an environment
 *    variable. `SIGNER_BACKEND=kms` delegates signing to AWS KMS so the private
 *    key never enters the process. `SIGNER_BACKEND=env` remains available for
 *    local development and tests only, and is rejected outside them.
 *
 * 2. Nonce serialisation. The gateway shares one operator account across all
 *    concurrent requests. Left alone, ethers fetches the pending nonce per
 *    send, so two in-flight transactions can claim the same nonce and one gets
 *    dropped or replaced. Every send is funnelled through a single-slot queue
 *    on top of ethers' NonceManager, which allocates nonces locally and in
 *    order. `reset()` re-syncs from the chain after a failure so a rejected
 *    transaction does not leave a permanent gap.
 */
import { ethers, JsonRpcProvider, NonceManager, Wallet, type Signer } from 'ethers';
import { logger } from '../utils/logger.js';

export interface ManagedSigner {
  /** The operator address transactions originate from. */
  getAddress(): Promise<string>;
  /** The ethers signer to bind contracts to. */
  signer: Signer;
  /**
   * Runs `fn` with exclusive access to the operator nonce sequence. All
   * contract writes must go through this.
   */
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;
  /** Re-syncs the local nonce with the chain after a failed send. */
  reset(): void;
}

class SerialisedSigner implements ManagedSigner {
  public readonly signer: Signer;
  private readonly nonceManager: NonceManager;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(base: Signer) {
    this.nonceManager = new NonceManager(base);
    this.signer = this.nonceManager;
  }

  async getAddress(): Promise<string> {
    return this.nonceManager.getAddress();
  }

  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    // Chain onto the tail of the queue so only one send is ever in flight.
    // `catch` on the tail keeps one failure from poisoning later callers.
    const result = this.queue.then(fn, fn);
    this.queue = result.catch(() => undefined);
    return result;
  }

  reset(): void {
    this.nonceManager.reset();
  }
}

interface KmsSignerModule {
  AwsKmsSigner: new (keyId: string, provider: JsonRpcProvider) => Signer;
}

/**
 * The KMS signer lives in a separate optional package so deployments that use
 * the env backend do not have to carry the AWS SDK. The specifier is held in a
 * variable so TypeScript treats it as a runtime import rather than trying to
 * resolve types for a package that may not be installed.
 */
const KMS_SIGNER_PACKAGE = '@teur/kms-signer';

async function createKmsSigner(provider: JsonRpcProvider, keyId: string): Promise<Signer> {
  let module: KmsSignerModule;
  try {
    module = (await import(KMS_SIGNER_PACKAGE)) as KmsSignerModule;
  } catch (error) {
    throw new Error(
      `SIGNER_BACKEND=kms requires the ${KMS_SIGNER_PACKAGE} package to be installed. ` +
        `Import failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  return new module.AwsKmsSigner(keyId, provider);
}

export async function createSigner(
  provider: JsonRpcProvider,
  options: {
    backend: 'env' | 'kms';
    privateKey?: string | undefined;
    kmsKeyId?: string | undefined;
    permitsLocalKeys: boolean;
  },
): Promise<ManagedSigner> {
  if (options.backend === 'kms') {
    if (!options.kmsKeyId) {
      throw new Error('SIGNER_BACKEND=kms requires SIGNER_KMS_KEY_ID');
    }
    const base = await createKmsSigner(provider, options.kmsKeyId);
    logger.info('BLOCKCHAIN_SERVICE', 'RESOURCE_CREATED', {
      resourceId: 'operator-signer',
      details: { backend: 'kms' },
    });
    return new SerialisedSigner(base);
  }

  if (!options.permitsLocalKeys) {
    throw new Error(
      'SIGNER_BACKEND=env exposes raw key material and is forbidden outside development and test. ' +
        'Set SIGNER_BACKEND=kms and SIGNER_KMS_KEY_ID.',
    );
  }
  if (!options.privateKey) {
    throw new Error('SIGNER_BACKEND=env requires BLOCKCHAIN_OPERATOR_PRIVATE_KEY');
  }

  logger.warn('BLOCKCHAIN_SERVICE', 'RESOURCE_CREATED', {
    resourceId: 'operator-signer',
    details: { backend: 'env', warning: 'raw key material in process memory' },
  });
  return new SerialisedSigner(new Wallet(options.privateKey, provider));
}

/** Exposed for tests that need a signer without a configured backend. */
export function wrapSignerForTest(base: Signer): ManagedSigner {
  return new SerialisedSigner(base);
}

export { ethers };
