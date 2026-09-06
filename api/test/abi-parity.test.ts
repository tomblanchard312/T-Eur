/**
 * Guards the gateway/contract interface boundary.
 *
 * The gateway's ABI fragments are hand-maintained, and a mismatch is silent:
 * a wrong argument count produces an unknown selector at call time, a
 * reordered tuple decodes to plausible-looking garbage, and a shifted enum
 * maps one wallet class onto another. None of that shows up in a unit test of
 * either side alone.
 *
 * This parses contracts/src directly and asserts that everything the gateway
 * declares actually exists on-chain with the same shape.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import {
  WalletRegistryABI,
  TokenizedEuroABI,
  ConditionalPaymentsABI,
  PermissioningABI,
  WalletType,
  ConditionType,
  PaymentStatus,
} from '../src/services/abi.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(here, '../../contracts/src');

function readContractSources(): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.sol')) files.push(full);
    }
  };
  walk(contractsDir);
  return files.map(file => readFileSync(file, 'utf8')).join('\n');
}

const sources = readContractSources();

/** Solidity type as written in source -> canonical ABI type. */
function canonicalType(solidityType: string): string {
  const base = solidityType.replace(/\s+/g, '');
  // Enums are uint8 in the ABI; structs and dynamic types are compared by name
  // elsewhere, so only the enum mapping matters here.
  if (['WalletType', 'ConditionType', 'PaymentStatus'].includes(base)) return 'uint8';
  if (base === 'uint') return 'uint256';
  return base;
}

/**
 * Collects `name(type,type)` for every external/public function declared
 * anywhere in the contract sources, plus the implicit getters generated for
 * public state variables.
 */
function collectContractSignatures(): Set<string> {
  const signatures = new Set<string>();

  const functionPattern = /function\s+(\w+)\s*\(([^)]*)\)\s*([^{;]*)/g;
  for (const match of sources.matchAll(functionPattern)) {
    const [, name, rawParams, modifiers] = match;
    if (!modifiers?.includes('external') && !modifiers?.includes('public')) continue;
    const types = (rawParams ?? '')
      .split(',')
      .map(param => param.trim())
      .filter(Boolean)
      .map(param => canonicalType(param.split(/\s+/)[0]!));
    signatures.add(`${name}(${types.join(',')})`);
  }

  // Public state variables get an auto-generated getter. Mappings take their
  // key type as the argument; plain variables take none.
  const mappingPattern = /mapping\s*\(\s*(\w+)\s*=>\s*[^)]+\)\s+public\s+(\w+)/g;
  for (const match of sources.matchAll(mappingPattern)) {
    signatures.add(`${match[2]}(${canonicalType(match[1]!)})`);
  }
  const scalarPattern = /^\s*(?:bool|uint256|address|string)\s+public\s+(?:constant\s+)?(\w+)/gm;
  for (const match of sources.matchAll(scalarPattern)) {
    signatures.add(`${match[1]}()`);
  }

  return signatures;
}

/** Collects `EventName(type,type)` for every event in the contract sources. */
function collectContractEvents(): Set<string> {
  const events = new Set<string>();
  const pattern = /event\s+(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  for (const match of sources.matchAll(pattern)) {
    const [, name, rawParams] = match;
    const types = (rawParams ?? '')
      .split(',')
      .map(param => param.trim())
      .filter(Boolean)
      .map(param => canonicalType(param.split(/\s+/)[0]!));
    events.add(`${name}(${types.join(',')})`);
  }
  return events;
}

const contractSignatures = collectContractSignatures();
const contractEvents = collectContractEvents();

const abis: Array<[string, readonly string[]]> = [
  ['WalletRegistry', WalletRegistryABI],
  ['TokenizedEuro', TokenizedEuroABI],
  ['ConditionalPayments', ConditionalPaymentsABI],
  ['Permissioning', PermissioningABI],
];

describe('gateway ABI parity with contracts/src', () => {
  it('parses the contract sources', () => {
    expect(contractSignatures.size).toBeGreaterThan(40);
    expect(contractEvents.size).toBeGreaterThan(10);
  });

  describe.each(abis)('%s', (_name, fragments) => {
    const iface = new ethers.Interface([...fragments]);

    it('declares only functions that exist on-chain with matching arity and types', () => {
      const missing: string[] = [];
      iface.forEachFunction(fn => {
        // `fn.format('sighash')` yields name(type,type) with canonical types.
        const signature = fn.format('sighash');
        if (!contractSignatures.has(signature)) missing.push(signature);
      });
      expect(missing, `not found in contracts/src: ${missing.join(', ')}`).toEqual([]);
    });

    it('declares only events that exist on-chain with matching arity and types', () => {
      const missing: string[] = [];
      iface.forEachEvent(event => {
        const signature = event.format('sighash');
        if (!contractEvents.has(signature)) missing.push(signature);
      });
      expect(missing, `not found in contracts/src: ${missing.join(', ')}`).toEqual([]);
    });
  });
});

describe('gateway enums mirror contract ordinals', () => {
  /** Reads `enum Name { A, B, C }` from the interface sources. */
  function contractEnum(name: string): string[] {
    const match = sources.match(new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`));
    expect(match, `enum ${name} not found in contracts/src`).toBeTruthy();
    // Comments must be stripped before splitting: the trailing `//` comments in
    // these enums contain commas of their own.
    return match![1]!
      .replace(/\/\/[^\n]*/g, '')
      .split(',')
      .map(member => member.trim())
      .filter(Boolean);
  }

  it.each([
    ['WalletType', WalletType],
    ['ConditionType', ConditionType],
    ['PaymentStatus', PaymentStatus],
  ])('%s', (name, gatewayEnum) => {
    const members = contractEnum(name);
    for (const [ordinal, member] of members.entries()) {
      expect(
        (gatewayEnum as Record<string, unknown>)[member],
        `${name}.${member} must be ${ordinal} to match the contract`,
      ).toBe(ordinal);
    }
    // No extra members: every gateway ordinal must be a real contract member.
    const numericKeys = Object.values(gatewayEnum).filter(v => typeof v === 'number') as number[];
    expect(numericKeys.length).toBe(members.length);
  });
});
