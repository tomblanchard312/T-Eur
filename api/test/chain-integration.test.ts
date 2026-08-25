/**
 * Gateway-against-deployed-contracts integration test.
 *
 * Every bug this covers was invisible to unit tests of either side: the gateway
 * mocked the chain, and the Foundry suite never exercised the gateway's ABI.
 * These cases only fail when real calldata meets a real deployment.
 *
 * Skipped unless TEUR_INTEGRATION_RPC_URL and the contract addresses are set,
 * so a developer without a local chain still gets a green suite. CI provides
 * them via anvil + DeployLabEnvironment (see .github/workflows/api-ci.yml).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import {
  WalletRegistryABI,
  TokenizedEuroABI,
  WalletType,
} from '../src/services/abi.js';

const rpcUrl = process.env['TEUR_INTEGRATION_RPC_URL'];
const registryAddress = process.env['CONTRACT_WALLET_REGISTRY'];
const tokenAddress = process.env['CONTRACT_TOKENIZED_EURO'];
const deployerKey = process.env['TEUR_INTEGRATION_DEPLOYER_KEY'];

const configured = Boolean(rpcUrl && registryAddress && tokenAddress && deployerKey);

describe.skipIf(!configured)('gateway calldata against deployed contracts', () => {
  let provider: ethers.JsonRpcProvider;
  let operator: ethers.Wallet;
  let registry: ethers.Contract;
  let token: ethers.Contract;

  // A funded holder used as the payer in the transferFrom case.
  let holder: ethers.Wallet;

  const bank = '0x00000000000000000000000000000000000000b1';
  const individual = '0x00000000000000000000000000000000000000a1';

  function keyFor(label: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(label));
  }

  beforeAll(async () => {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    operator = new ethers.Wallet(deployerKey!, provider);
    registry = new ethers.Contract(registryAddress!, [...WalletRegistryABI], operator);
    token = new ethers.Contract(tokenAddress!, [...TokenizedEuroABI], operator);

    holder = ethers.Wallet.createRandom().connect(provider);
    await (await operator.sendTransaction({
      to: holder.address,
      value: ethers.parseEther('1'),
    })).wait();
  });

  it('registers a bank and an individual using the contract enum ordinals', async () => {
    // Under the previous off-by-one enum, BANK encoded as NCB and INDIVIDUAL as
    // UNREGISTERED, so the registry ended up describing different wallet classes
    // than the API reported.
    await (await registry.registerWallet(
      bank,
      WalletType.BANK,
      ethers.ZeroAddress,
      keyFor('kyc-bank'),
    )).wait();

    await (await registry.registerWallet(
      individual,
      WalletType.INDIVIDUAL,
      bank,
      keyFor('kyc-individual'),
    )).wait();

    const bankInfo = await registry.getWalletInfo(bank);
    const individualInfo = await registry.getWalletInfo(individual);

    expect(Number(bankInfo.walletType)).toBe(WalletType.BANK);
    expect(Number(individualInfo.walletType)).toBe(WalletType.INDIVIDUAL);
  });

  it('decodes WalletInfo in the contract struct order', async () => {
    // A reordered tuple decodes without error but yields nonsense: isActive
    // would read from the address slot and linkedBankAccount from the bool.
    const info = await registry.getWalletInfo(individual);

    expect(info.isActive).toBe(true);
    expect(ethers.getAddress(info.linkedBankAccount)).toBe(ethers.getAddress(bank));
    expect(info.kycHash).toBe(keyFor('kyc-individual'));
    expect(Number(info.registrationTime)).toBeGreaterThan(0);
  });

  it('mints with the three-argument contract signature', async () => {
    // The gateway previously declared a four-argument mint carrying a
    // justification string, producing an unknown selector on every call.
    const before = await token.balanceOf(holder.address);
    await (await token.mint(holder.address, 100_00n, keyFor('mint-1'))).wait();
    const after = await token.balanceOf(holder.address);

    expect(after - before).toBe(100_00n);
  });

  it('rejects a duplicate mint idempotency key', async () => {
    await expect(
      token.mint(holder.address, 100_00n, keyFor('mint-1')),
    ).rejects.toThrow();
  });

  it('moves funds from the payer, not the operator, and requires an allowance', async () => {
    // The original defect: the gateway called transfer() as the operator, so the
    // operator's own balance funded every "user" transfer while the audit record
    // named the user as payer.
    const asHolder = token.connect(holder) as ethers.Contract;
    const operatorBefore = await token.balanceOf(operator.address);

    // No allowance yet: the operator must not be able to move the holder's funds.
    await expect(
      token.transferFrom(holder.address, bank, 10_00n),
    ).rejects.toThrow();

    await (await asHolder.approve(operator.address, 10_00n)).wait();

    const holderBefore = await token.balanceOf(holder.address);
    const bankBefore = await token.balanceOf(bank);
    await (await token.transferFrom(holder.address, bank, 10_00n)).wait();

    expect(await token.balanceOf(holder.address)).toBe(holderBefore - 10_00n);
    expect(await token.balanceOf(bank)).toBe(bankBefore + 10_00n);
    // The operator financed none of it.
    expect(await token.balanceOf(operator.address)).toBe(operatorBefore);
  });

  it('exposes escrowedBalances as separate members, not a tuple', async () => {
    // Solidity's generated getter for a struct mapping returns the members
    // flattened; declaring it as a tuple decodes incorrectly.
    const record = await token.escrowedBalances(individual);
    expect(record.amount).toBeDefined();
    expect(typeof record.legalBasis).toBe('string');
    expect(record.expiry).toBeDefined();
  });
});
