import { describe, expect, it } from 'vitest';
import { Interface, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { config } from '../src/config/index.js';
import { ConditionalPaymentsABI, TokenizedEuroABI, ConditionType } from '../src/services/abi.js';
import {
  broadcastSignedConditionalPayment,
  broadcastSignedDeliveryConfirmation,
  broadcastSignedTransfer,
} from '../src/services/signedTransaction.js';
import { confirmDeliverySchema, createConditionalPaymentSchema, transferSchema } from '../src/schemas/index.js';

const token = new Interface(TokenizedEuroABI);
const payments = new Interface(ConditionalPaymentsABI);

async function sign(wallet: Wallet, to: string, data: string): Promise<string> {
  return wallet.signTransaction({
    to,
    data,
    chainId: config.blockchain.chainId,
    nonce: 0,
    gasLimit: 500_000,
    gasPrice: 1,
    value: 0,
  });
}

describe('payer custody', () => {
  it('requires a payer-signed transaction on ordinary transfers', () => {
    const parsed = transferSchema.safeParse({
      from: Wallet.createRandom().address,
      to: Wallet.createRandom().address,
      amount: 100,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a transfer signed by a different wallet before broadcast', async () => {
    const payer = Wallet.createRandom();
    const attacker = Wallet.createRandom();
    const to = Wallet.createRandom().address;
    const rawTransaction = await sign(
      attacker,
      config.contracts.tokenizedEuro,
      token.encodeFunctionData('transfer', [to, 100n]),
    );

    await expect(broadcastSignedTransfer({
      rawTransaction,
      payer: payer.address,
      to,
      amount: 100n,
    })).rejects.toThrow(/declared payer/i);
  });

  it('rejects signed transfer calldata that changes the requested payee', async () => {
    const payer = Wallet.createRandom();
    const requestedTo = Wallet.createRandom().address;
    const signedTo = Wallet.createRandom().address;
    const rawTransaction = await sign(
      payer,
      config.contracts.tokenizedEuro,
      token.encodeFunctionData('transfer', [signedTo, 100n]),
    );

    await expect(broadcastSignedTransfer({
      rawTransaction,
      payer: payer.address,
      to: requestedTo,
      amount: 100n,
    })).rejects.toThrow(/argument 0/i);
  });

  it('requires a payer and signed transaction for conditional payment creation', () => {
    const parsed = createConditionalPaymentSchema.safeParse({
      payee: Wallet.createRandom().address,
      amount: 100,
      conditionType: 'DELIVERY',
      conditionData: keccak256(toUtf8Bytes('delivery')),
      expiresAt: Math.floor(Date.now() / 1000) + 7200,
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects conditional payment creation signed by another payer', async () => {
    const payer = Wallet.createRandom();
    const attacker = Wallet.createRandom();
    const payee = Wallet.createRandom().address;
    const arbiter = Wallet.createRandom().address;
    const idempotencyKey = '00000000-0000-4000-8000-000000000003';
    const key = keccak256(toUtf8Bytes(idempotencyKey));
    const conditionData = keccak256(toUtf8Bytes('delivery'));
    const expiresAt = Math.floor(Date.now() / 1000) + 7200;
    const rawTransaction = await sign(
      attacker,
      config.contracts.conditionalPayments,
      payments.encodeFunctionData('createConditionalPayment', [
        payee,
        100n,
        ConditionType.DELIVERY,
        conditionData,
        expiresAt,
        arbiter,
        key,
      ]),
    );

    await expect(broadcastSignedConditionalPayment({
      rawTransaction,
      payer: payer.address,
      payee,
      amount: 100n,
      conditionType: ConditionType.DELIVERY,
      conditionData,
      expiresAt,
      arbiter,
      idempotencyKey,
    })).rejects.toThrow(/declared payer/i);
  });

  it('requires payer authorization data for delivery confirmation', () => {
    const parsed = confirmDeliverySchema.safeParse({
      paymentId: keccak256(toUtf8Bytes('payment')),
      proof: keccak256(toUtf8Bytes('proof')),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects delivery confirmation signed by a different wallet before broadcast', async () => {
    const payer = Wallet.createRandom();
    const attacker = Wallet.createRandom();
    const paymentId = keccak256(toUtf8Bytes('payment-2'));
    const proof = keccak256(toUtf8Bytes('proof-2'));
    const rawTransaction = await sign(
      attacker,
      config.contracts.conditionalPayments,
      payments.encodeFunctionData('confirmDelivery', [paymentId, proof]),
    );

    await expect(broadcastSignedDeliveryConfirmation({
      rawTransaction,
      payer: payer.address,
      paymentId,
      proof,
    })).rejects.toThrow(/declared payer/i);
  });

  it('rejects delivery confirmation with altered proof calldata', async () => {
    const payer = Wallet.createRandom();
    const paymentId = keccak256(toUtf8Bytes('payment-3'));
    const requestedProof = keccak256(toUtf8Bytes('proof-requested'));
    const signedProof = keccak256(toUtf8Bytes('proof-signed'));
    const rawTransaction = await sign(
      payer,
      config.contracts.conditionalPayments,
      payments.encodeFunctionData('confirmDelivery', [paymentId, signedProof]),
    );

    await expect(broadcastSignedDeliveryConfirmation({
      rawTransaction,
      payer: payer.address,
      paymentId,
      proof: requestedProof,
    })).rejects.toThrow(/argument 1/i);
  });
});
