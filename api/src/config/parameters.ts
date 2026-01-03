import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export const parametersSchema = z.object({
  holding_limit_individual: z.number().nonnegative(),
  holding_limit_merchant: z.number().nonnegative(),
  offline_cap_per_device: z.number().nonnegative(),
  transfer_velocity_limit_window_seconds: z.number().int().positive(),
  transfer_velocity_limit_max_amount: z.number().nonnegative(),
  fee_transfer_basis_points: z.number().nonnegative(),
  governance_change_delay_seconds: z.number().int().nonnegative(),
  offline_reconciliation_window_seconds: z.number().int().nonnegative(),
  offline_daily_velocity_per_wallet: z.number().nonnegative(),
  // Fee parameters (governance-controlled)
  fee_merchant_retail_bps: z.number().nonnegative(),
  fee_merchant_hospitality_bps: z.number().nonnegative(),
  fee_merchant_ecommerce_bps: z.number().nonnegative(),
  fee_instant_settlement_fixed_cents: z.number().nonnegative(),
  fee_cross_border_bps: z.number().nonnegative(),
  fee_atm_fixed_cents: z.number().nonnegative(),
  fee_atm_bps: z.number().nonnegative(),
  // Compliance parameters
  high_risk_countries: z.array(z.string()),
  suspicious_volume_threshold_cents: z.number().nonnegative(),
  default_arbiter_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export type Parameters = z.infer<typeof parametersSchema>;

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
    const parsedRaw = JSON.parse(raw);
    const parsed = parametersSchema.parse(parsedRaw);
    cached = parsed;
    return parsed;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const pretty = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Parameters validation failed (${filePath}): ${pretty}`);
    }
    throw new Error(`Failed to load parameters from ${filePath}: ${err}`);
  }
}

export const parameters = loadParameters();
