import fs from 'fs';
import path from 'path';

export type Parameters = {
  holding_limit_individual: number;
  holding_limit_merchant: number;
  offline_cap_per_device: number;
  transfer_velocity_limit_window_seconds: number;
  transfer_velocity_limit_max_amount: number;
  fee_transfer_basis_points: number;
  governance_change_delay_seconds: number;
  offline_reconciliation_window_seconds: number;
  offline_daily_velocity_per_wallet: number;
};

const defaultPath = path.resolve(process.cwd(), 'envs/lab/ecb-core/parameters.json');
const filePath = process.env['PARAMETERS_FILE'] || defaultPath;

let cached: Parameters | null = null;

export function loadParameters(): Parameters {
  if (cached) return cached;
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Parameters file not found: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Parameters;
    // Basic validation
    if (typeof parsed.holding_limit_individual !== 'number') {
      throw new Error('Invalid parameters: holding_limit_individual required');
    }
    cached = parsed;
    return parsed;
  } catch (err) {
    throw new Error(`Failed to load parameters from ${filePath}: ${err}`);
  }
}

export const parameters = loadParameters();
