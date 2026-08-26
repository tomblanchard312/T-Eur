import { Interface, JsonRpcProvider, Transaction, getAddress } from 'ethers';
import { config } from '../config/index.js';
import { BlockchainError, ValidationError } from '../middleware/errors.js';
import { ConditionalPaymentsABI, TokenizedEuroABI } from './abi.js';

const tokenInterface = new Interface(TokenizedEuroABI);
const conditionalPaymentsInterface = new Interface(ConditionalPaymentsABI);
const provider = new JsonRpcProvider(config.blockchain.rpcUrl);

function normalize(address: string): string {
  return getAddress(address).toLowerCase();
}

function assertSignedTransaction(rawTransaction: string): Transaction {
  let tx: Transaction;
  try {
    tx = Transaction.from(rawTransaction);
  } catch {
    throw new ValidationError('Invalid signed transaction');
  }

  if (!tx.signature || !tx.from) {
    throw new ValidationError('Transaction must be signed by the payer');
  }
  if (tx.chainId !== BigInt(config.blockchain.chainId)) {
    throw new ValidationError('Signed transaction targets the wrong chain');
  }
  if (tx.value !== 0n) {
    throw new ValidationError('Payer transaction must not transfer native currency');
  }
  return tx;
}

function equalArg(actual: unknown, expected: unknown): boolean {
  if (typeof expected === 'bigint') return BigInt(String(actual)) === expected;
  if (typeof expected === 'number') return BigInt(String(actual)) === BigInt(expected);
  if (typeof expected === 'string' && /^0x[a-fA-F0-9]{40}$/.test(expected)) {
    return normalize(String(actual)) === normalize(expected);
  }
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

async function broadcastValidated(
  rawTransaction: string,
  expectedContract: string,
  iface: Interface,
  expectedFunction: string,
  expectedArgs: unknown[],
  expectedPayer: string,
): Promise<{ txHash: string; blockNumber: number; from: string; receipt: import('ethers').TransactionReceipt }> {
  const tx = assertSignedTransaction(rawTransaction);

  if (!tx.to || normalize(tx.to) !== normalize(expectedContract)) {
    throw new ValidationError('Signed transaction targets an unexpected contract');
  }
  if (normalize(tx.from!) !== normalize(expectedPayer)) {
    throw new ValidationError('Signed transaction was not signed by the declared payer');
  }

  let parsed;
  try {
    parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
  } catch {
    throw new ValidationError('Signed transaction calldata is invalid');
  }
  if (!parsed || parsed.name !== expectedFunction) {
    throw new ValidationError(`Signed transaction must call ${expectedFunction}`);
  }
  if (parsed.args.length !== expectedArgs.length) {
    throw new ValidationError('Signed transaction argument count does not match the request');
  }
  for (let i = 0; i < expectedArgs.length; i += 1) {
    if (!equalArg(parsed.args[i], expectedArgs[i])) {
      throw new ValidationError(`Signed transaction argument ${i} does not match the request`);
    }
  }

  let response;
  try {
    response = await provider.broadcastTransaction(rawTransaction);
  } catch (error) {
    throw new BlockchainError('Failed to broadcast payer-signed transaction', error);
  }

  const receipt = await response.wait(config.blockchain.confirmations);
  if (!receipt || receipt.status !== 1) {
    throw new BlockchainError('Payer-signed transaction was not confirmed successfully');
  }

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    from: tx.from!,
    receipt,
  };
}

export async function broadcastSignedTransfer(params: {
  rawTransaction: string;
  payer: string;
  to: string;
  amount: bigint;
}) {
  return broadcastValidated(
    params.rawTransaction,
    config.contracts.tokenizedEuro,
    tokenInterface,
    'transfer',
    [params.to, params.amount],
    params.payer,
  );
}

export async function broadcastSignedConditionalPayment(params: {
  rawTransaction: string;
  payer: string;
  payee: string;
  amount: bigint;
  conditionType: number;
  conditionData: string;
  expiresAt: number;
  arbiter: string;
  idempotencyKey: string;
}) {
  const idempotencyBytes32 = /^0x[a-fA-F0-9]{64}$/.test(params.idempotencyKey)
    ? params.idempotencyKey
    : (await import('ethers')).keccak256((await import('ethers')).toUtf8Bytes(params.idempotencyKey));

  const result = await broadcastValidated(
    params.rawTransaction,
    config.contracts.conditionalPayments,
    conditionalPaymentsInterface,
    'createConditionalPayment',
    [
      params.payee,
      params.amount,
      params.conditionType,
      params.conditionData,
      params.expiresAt,
      params.arbiter,
      idempotencyBytes32,
    ],
    params.payer,
  );

  const event = result.receipt.logs
    .map(log => {
      try {
        return conditionalPaymentsInterface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(parsed => parsed?.name === 'ConditionalPaymentCreated');

  if (!event) throw new BlockchainError('ConditionalPaymentCreated event not found in transaction receipt');

  return {
    txHash: result.txHash,
    blockNumber: result.blockNumber,
    payer: result.from,
    paymentId: event.args.paymentId as string,
  };
}
